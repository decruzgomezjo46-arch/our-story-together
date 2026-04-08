// app.js

// ==========================================
// 🔴 CONFIGURACIÓN DE FIREBASE (Base de Datos)
// ==========================================
// Cuando tengas tu cuenta de Firebase, reemplaza estos valores con los que te den:
const firebaseConfig = {
    apiKey: "AIzaSyBgfoX5mHQRYHjKVPItByjo1dwMFF0iJfI",
    authDomain: "amorapp-68726.firebaseapp.com",
    projectId: "amorapp-68726",
    storageBucket: "amorapp-68726.firebasestorage.app",
    messagingSenderId: "1081970754013",
    appId: "1:1081970754013:web:311948fbbb559bddcd3634"
};

// Inicialización de Firebase
const isFirebaseConfigured = true;
let app, db, storage;
try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    // storage = firebase.storage(); // Desactivado por falta de presupuesto
    console.log("🔥 Firebase (Base de Datos) activado con éxito!");
} catch (e) {
    console.error("Error inicializando Firebase:", e);
}

// Configuración de Cloudinary (Para fotos y videos gratis)
const CLOUDINARY_CLOUD_NAME = "dwdxuhcmz";
const CLOUDINARY_UPLOAD_PRESET = "recuerdos_preset";

// Variables Globales
let recuerdos = [];
let editandoId = null;
let currentMediaArray = []; // Arreglo para múltiples fotos y videos {file, type, preview}
let currentFilterYear = 'Todos';
let currentSearchTerm = '';

// ==========================================
// 🕒 CONTADOR DE TIEMPO Y AUDIO
// ==========================================
const START_DATE = new Date("2024-10-02T00:00:00");

function updateCounter() {
    const now = new Date();

    let years = now.getFullYear() - START_DATE.getFullYear();
    let months = now.getMonth() - START_DATE.getMonth();
    let days = now.getDate() - START_DATE.getDate();

    // Ajustar si aún no hemos llegado al día en este mes
    if (days < 0) {
        months--;
        // Obtener la cantidad de días del mes anterior
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += prevMonth.getDate();
    }

    // Ajustar si aún no hemos llegado al mes en este año
    if (months < 0) {
        years--;
        months += 12;
    }

    let text = "";
    if (years > 0) text += `${years} año${years > 1 ? 's' : ''}, `;
    if (months > 0) text += `${months} mes${months > 1 ? 'es' : ''} y `;
    text += `${days} día${days !== 1 ? 's' : ''}`;

    const counterEl = document.getElementById('time-together');
    if (counterEl) counterEl.innerText = `Llevamos ${text} juntos`;
}

function setupAudio() {
    const audio = document.getElementById('bg-audio');
    const audioBtn = document.getElementById('audio-btn');
    if (!audio || !audioBtn) return;

    // Audio initial state
    audio.volume = 0.5;

    audioBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            audioBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausar Canción';
        } else {
            audio.pause();
            audioBtn.innerHTML = '<i class="fa-solid fa-play"></i> Nuestra Canción';
        }
    });
}

// ==========================================
// 🌙 MODO OSCURO
// ==========================================
function setupDarkMode() {
    const toggleBtn = document.getElementById('theme-toggle');
    const isDark = localStorage.getItem('darkMode') === 'true';

    if (isDark) {
        document.body.classList.add('dark-mode');
        toggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const currentlyDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', currentlyDark);
        toggleBtn.innerHTML = currentlyDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
}

// ==========================================
// 🚀 INICIALIZACIÓN Y CARGA DE DATOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Configurar nuevas funciones
    updateCounter();
    setInterval(updateCounter, 1000 * 60 * 60); // Actualizar cada hora
    setupAudio();
    setupDarkMode();
    setupDragAndDrop();
    setupFiltersAndSearch();
    setupForm();
    setupLightbox();
    createFloatingHearts();
    setupSmartNavbar();
    setupBirthdayLock();

    // Cargar datos

    // Cargar datos
    if (isFirebaseConfigured) {
        // Escucha en tiempo real de Firebase
        db.collection('recuerdos').onSnapshot((snapshot) => {
            recuerdos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            aplicarFiltrosYRenderizar();
        });
    } else {
        // Carga local
        recuerdos = JSON.parse(localStorage.getItem('amorRecuerdos')) || [];
        aplicarFiltrosYRenderizar();
    }

    // Make functions globally available for inline HTML onclicks 
    // (since type="module" scopes variables)
    window.switchTab = switchTab;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.editarRecuerdo = editarRecuerdo;
    window.eliminarRecuerdo = eliminarRecuerdo;
    window.toggleFormFields = toggleFormFields;
});

window.switchTab = function (tabId) {
    document.querySelectorAll('.tab-pane').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    const activeLink = document.querySelector(`.nav-links a[onclick="switchTab('${tabId}')"]`);
    if (activeLink) activeLink.classList.add('active');

    // Activar animaciones si es historia
    if (tabId === 'historia') setTimeout(observeScroll, 100);
}

// ==========================================
// 🔍 BUSCADOR Y FILTROS
// ==========================================
function setupFiltersAndSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.toLowerCase();
        aplicarFiltrosYRenderizar();
    });
}

function generarBotonesFiltro() {
    const yearsSet = new Set();
    recuerdos.forEach(r => {
        if (r.fecha) yearsSet.add(r.fecha.substring(0, 4));
    });

    const yearsArray = Array.from(yearsSet).sort((a, b) => b - a); // Descendente
    const container = document.getElementById('yearFilters');
    if (!container) return;

    container.innerHTML = `<button class="filter-btn ${currentFilterYear === 'Todos' ? 'active' : ''}" onclick="window.setFilterYear('Todos')">Todos</button>`;

    yearsArray.forEach(year => {
        container.innerHTML += `<button class="filter-btn ${currentFilterYear === year ? 'active' : ''}" onclick="window.setFilterYear('${year}')">${year}</button>`;
    });
}

window.setFilterYear = function (year) {
    currentFilterYear = year;
    aplicarFiltrosYRenderizar();
}

function aplicarFiltrosYRenderizar() {
    generarBotonesFiltro();

    // Ordenar cronológicamente ascendente
    let filtrados = [...recuerdos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Aplicar Año
    if (currentFilterYear !== 'Todos') {
        filtrados = filtrados.filter(r => r.fecha && r.fecha.startsWith(currentFilterYear));
    }

    // Aplicar Búsqueda
    if (currentSearchTerm) {
        filtrados = filtrados.filter(r =>
            (r.titulo && r.titulo.toLowerCase().includes(currentSearchTerm)) ||
            (r.descripcion && r.descripcion.toLowerCase().includes(currentSearchTerm))
        );
    }

    renderData(filtrados);
}

// ==========================================
// 🎨 ANIMACIONES Y LIGHTBOX
// ==========================================
function observeScroll() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.querySelector('.lightbox-close');

    if (!lightbox) return;

    closeBtn.onclick = () => lightbox.style.display = "none";
    window.openLightbox = function (src, title, type = 'image') {
        const img = document.getElementById('lightbox-img');
        const video = document.getElementById('lightbox-video');
        
        if (type === 'video') {
            img.style.display = 'none';
            video.style.display = 'block';
            video.src = src;
            video.play();
        } else {
            video.style.display = 'none';
            video.play(); // Detener video si estaba sonando
            img.style.display = 'block';
            img.src = src;
        }
        
        document.getElementById('lightbox-caption').innerText = title || '';
        lightbox.style.display = "block";
    };
}

// ==========================================
// 🖱️ DRAG AND DROP (SUBIR FOTOS)
// ==========================================
function setupDragAndDrop() {
    const dropArea = document.getElementById('dragDropArea');
    const fileInput = document.getElementById('fotoUpload');
    const previewContainer = document.getElementById('imagePreviewContainer');

    if (!dropArea) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
    });

    dropArea.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files), false);
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files), false);

    async function handleFiles(files) {
        if (!files.length) return;
        
        // Bloquear botón de envío mientras se procesan archivos
        const saveBtn = document.querySelector('.btn-submit');
        if(saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando archivos...';
        }

        dropArea.style.display = 'none';
        previewContainer.style.display = 'flex';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');

            if (!isImage && !isVideo) continue;

            if (currentMediaArray.length >= 10) {
                alert("Has alcanzado el límite máximo de 10 archivos por recuerdo.");
                break;
            }

            try {
                if (isImage) {
                    const compressedBlob = await resizeAndCompressImage(file);
                    currentMediaArray.push({
                        file: file, 
                        type: 'image',
                        data: URL.createObjectURL(compressedBlob) // Usar URL de objeto para previsualización
                    });
                } else if (isVideo) {
                    const videoPreview = await getVideoThumbnail(file);
                    currentMediaArray.push({
                        file: file,
                        type: 'video',
                        data: videoPreview
                    });
                }
                renderMiniatures();
            } catch (err) {
                console.error("Error al procesar archivo:", err);
            }
        }

        // Restaurar botón de envío
        if(saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Guardar para siempre <i class="fa-solid fa-heart"></i>';
        }

        // Si no se pudo cargar nada, volver a mostrar el área de drop
        if (currentMediaArray.length === 0) {
            dropArea.style.display = 'block';
            previewContainer.style.display = 'none';
        }
    }
}

async function getVideoThumbnail(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        
        const url = URL.createObjectURL(file);
        video.src = url;

        // Timeout de seguridad: si no carga en 4s, devolvemos un ícono genérico
        const timeout = setTimeout(() => {
            console.warn("⏱️ Tiempo de espera agotado para la miniatura del video.");
            URL.revokeObjectURL(url);
            // Devolver un icono de video base64 genérico o color plano
            resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
        }, 4000);

        video.onloadedmetadata = () => {
            // Intentamos capturar el frame en el segundo 0.2
            video.currentTime = 0.2;
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 320;
                canvas.height = video.videoHeight || 180;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                resolve(dataUrl);
            } catch (e) {
                console.error("❌ Error capturando frame:", e);
                resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
            }
        };

        video.onerror = () => {
            console.error("❌ Error cargando el video para miniatura.");
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
        };
    });
}

function renderMiniatures() {
    const container = document.getElementById('imagePreviewContainer');
    container.innerHTML = '';

    if (currentMediaArray.length === 0) {
        container.style.display = 'none';
        document.getElementById('dragDropArea').style.display = 'block';
        return;
    }

    currentMediaArray.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'mini-preview';
        const icon = item.type === 'video' ? '<i class="fa-solid fa-play mini-video-icon"></i>' : '';
        div.innerHTML = `
            <img src="${item.data}">
            ${icon}
            <button type="button" class="remove-mini" onclick="window.removeMiniature(${index})"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(div);
    });
}

window.removeMiniature = function (index) {
    currentMediaArray.splice(index, 1);
    renderMiniatures();
}

function resizeAndCompressImage(file, maxWidth = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (event) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
            img.onerror = err => reject(err);
            img.src = event.target.result;
        };
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });
}

async function uploadToCloudinary(blob, fileName, type) {
    console.log(`☁️ Subiendo ${type} a Cloudinary: ${fileName}`);
    const resourceType = type === 'video' ? 'video' : 'image';
    
    // Al usar Cloudinary, podemos añadir parámetros de optimización en la subida si fuera necesario,
    // pero el "Unsigned Upload Preset" ya puede tener estas reglas configuradas.
    const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

    const formData = new FormData();
    formData.append("file", blob);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("public_id", `recuerdo_${Date.now()}`);

    const response = await fetch(url, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || "Error al subir a Cloudinary");
    }

    const data = await response.json();
    console.log("✅ Subido a Cloudinary exitosamente:", data.secure_url);
    return data.secure_url;
}

// ==========================================
// 📝 MODAL Y FORMULARIO
// ==========================================
window.openModal = function () {
    document.getElementById('uploadModal').style.display = 'block';
    document.getElementById('uploadForm').reset();
    resetPhotoInput();
    editandoId = null;
    document.querySelector('.modal-title').innerText = 'Guardar un Nuevo Recuerdo';
    window.toggleFormFields();
}

function resetPhotoInput() {
    currentMediaArray = [];
    document.getElementById('fotoUpload').value = '';
    document.getElementById('imagePreviewContainer').style.display = 'none';
    document.getElementById('imagePreviewContainer').innerHTML = ''; // Limpiar miniaturas
    document.getElementById('dragDropArea').style.display = 'block';
}

window.editarRecuerdo = function (id) {
    const pass = prompt("Por seguridad, introduce la contraseña para editar (Por defecto es: amor123):");
    if (pass !== "Nuestroamorperdura") {
        if (pass !== null) alert("Contraseña incorrecta.");
        return;
    }

    const recuerdo = recuerdos.find(r => r.id === id);
    if (!recuerdo) return;

    editandoId = id;
    document.getElementById('uploadModal').style.display = 'block';
    document.querySelector('.modal-title').innerText = 'Editar Recuerdo';

    document.getElementById('tipoRecuerdo').value = recuerdo.tipo;
    document.getElementById('titulo').value = recuerdo.titulo || '';
    document.getElementById('fecha').value = recuerdo.fecha || '';
    document.getElementById('descripcion').value = recuerdo.descripcion || '';

    resetPhotoInput();
    const hasMedia = recuerdo.media && recuerdo.media.length > 0;
    const hasFotos = recuerdo.fotos && recuerdo.fotos.length > 0;
    const hasOldFoto = recuerdo.foto;

    if (hasMedia) {
        currentMediaArray = recuerdo.media.map(m => ({ ...m, data: m.url }));
    } else if (hasFotos) {
        currentMediaArray = recuerdo.fotos.map(url => ({ url, type: 'image', data: url }));
    } else if (hasOldFoto) {
        currentMediaArray = [{ url: recuerdo.foto, type: 'image', data: recuerdo.foto }];
    }

    if (currentMediaArray.length > 0) {
        document.getElementById('dragDropArea').style.display = 'none';
        document.getElementById('imagePreviewContainer').style.display = 'flex';
        renderMiniatures();
    }

    window.toggleFormFields();
}

window.eliminarRecuerdo = async function (id) {
    const pass = prompt("Por seguridad, introduce la contraseña para eliminar.");
    if (pass !== "Nuestroamorperdura") {
        if (pass !== null) alert("Contraseña incorrecta.");
        return;
    }

    if (confirm("¿Estás seguro de que deseas eliminar este recuerdo para siempre?")) {
        if (isFirebaseConfigured) {
            await db.collection("recuerdos").doc(id).delete();
        } else {
            recuerdos = recuerdos.filter(r => r.id !== id);
            localStorage.setItem('amorRecuerdos', JSON.stringify(recuerdos));
            aplicarFiltrosYRenderizar();
        }
    }
}

window.closeModal = function () {
    document.getElementById('uploadModal').style.display = 'none';
}

window.onclick = function (event) {
    const modal = document.getElementById('uploadModal');
    if (event.target == modal) window.closeModal();
}

window.toggleFormFields = function () {
    const tipo = document.getElementById('tipoRecuerdo').value;
    const gTitulo = document.getElementById('group-titulo');
    const gFecha = document.getElementById('group-fecha');
    const gDesc = document.getElementById('group-descripcion');
    const gFoto = document.getElementById('group-foto');

    document.getElementById('titulo').required = true;
    document.getElementById('fecha').required = true;
    document.getElementById('descripcion').required = (tipo !== 'foto');

    gDesc.style.display = (tipo === 'foto' || tipo === 'video') ? 'none' : 'block';
    gFoto.style.display = (tipo === 'historia') ? 'none' : 'block';

    const labelMedia = document.getElementById('label-media');
    const dragText = document.getElementById('drag-drop-text');

    if (tipo === 'video') {
        labelMedia.innerText = "Video del Recuerdo";
        dragText.innerText = "Arrastra y suelta tu video aquí";
    } else if (tipo === 'foto') {
        labelMedia.innerText = "Fotografía del Recuerdo";
        dragText.innerText = "Arrastra y suelta tu foto aquí";
    } else {
        labelMedia.innerText = "Multimedia del Recuerdo";
        dragText.innerText = "Arrastra y suelta tus fotos o videos aquí";
    }
}

function setupForm() {
    const form = document.getElementById('uploadForm');
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const saveBtn = form.querySelector('.btn-submit');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            const tipo = document.getElementById('titulo').value ? document.getElementById('tipoRecuerdo').value : 'historia';
            const filesToUpload = [];

            if (tipo === 'ambos' || tipo === 'foto' || tipo === 'video') {
                if (currentMediaArray.length === 0) {
                    alert('Por favor agrega al menos un archivo multimedia.');
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = 'Guardar para siempre <i class="fa-solid fa-heart"></i>';
                    return;
                }

                // Proceso de compresión y subida
                for (const item of currentMediaArray) {
                    let blob = item.file; // Por defecto el original

                    if (item.type === 'image') {
                        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Optimizando foto...`;
                        blob = await resizeAndCompressImage(item.file);
                    }
                    // Para videos, Cloudinary se encarga de la optimización al recibir el original
                    
                    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Subiendo a la nube (Cloudinary)...`;
                    let url;
                    try {
                        url = await uploadToCloudinary(blob, item.file.name, item.type);
                    } catch (uploadErr) {
                        console.error("❌ Error en Cloudinary:", uploadErr);
                        alert("Error al subir a Cloudinary: " + uploadErr.message);
                        throw uploadErr;
                    }
                    
                    if (url) {
                        filesToUpload.push({ url, type: item.type });
                    } else {
                        throw new Error(`Fallo al subir el archivo ${item.file.name}`);
                    }
                }
            }

            const data = {
                tipo: tipo,
                titulo: document.getElementById('titulo').value,
                fecha: document.getElementById('fecha').value,
                descripcion: document.getElementById('descripcion').value || '',
                media: filesToUpload,
                // Mantener compatibilidad con fotos viejas
                fotos: filesToUpload.filter(f => f.type === 'image').map(f => f.url)
            };

            if (isFirebaseConfigured) {
                if (editandoId) {
                    await db.collection("recuerdos").doc(editandoId).update(data);
                } else {
                    await db.collection("recuerdos").add(data);
                }
            } else {
                if (editandoId) {
                    const index = recuerdos.findIndex(r => r.id === editandoId);
                    if (index !== -1) recuerdos[index] = { ...recuerdos[index], ...data };
                } else {
                    recuerdos.push({ id: Date.now().toString(), ...data });
                }
                localStorage.setItem('amorRecuerdos', JSON.stringify(recuerdos));
                aplicarFiltrosYRenderizar();
            }

            window.closeModal();
            setTimeout(() => {
                window.showToast("¡Recuerdo guardado con éxito! 💖");
                if (tipo === 'foto') window.switchTab('galeria');
                else window.switchTab('historia');
            }, 300);

        } catch (error) {
            alert('Error al guardar: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Guardar para siempre <i class="fa-solid fa-heart"></i>';
        }
    });
}

// ==========================================
// 🖥️ RENDERIZADO VISUAL
// ==========================================
function renderData(dataToRender) {
    const timeline = document.getElementById('timeline-container');
    const emptyTimeline = document.getElementById('empty-timeline');
    const gallery = document.getElementById('gallery-container');

    document.querySelectorAll('.timeline-item').forEach(item => item.remove());
    gallery.innerHTML = '';

    if (dataToRender.length === 0) {
        emptyTimeline.style.display = 'block';
        gallery.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px; color:var(--text-muted);">Aún no hay fotos.</div>';
        return;
    }

    emptyTimeline.style.display = 'none';
    let isLeft = true;

    dataToRender.forEach((recuerdo) => {
        // Normalizar multimedia (Compatibilidad vieja)
        let mediaArray = recuerdo.media ? recuerdo.media : [];
        if (mediaArray.length === 0) {
            if (recuerdo.fotos) mediaArray = recuerdo.fotos.map(url => ({ url, type: 'image' }));
            else if (recuerdo.foto) mediaArray = [{ url: recuerdo.foto, type: 'image' }];
        }

        // Render Timeline
        if (recuerdo.tipo === 'ambos' || recuerdo.tipo === 'historia' || recuerdo.tipo === 'video') {
            const dateObj = new Date(recuerdo.fecha + 'T00:00:00');
            const fechaFormateada = dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

            const div = document.createElement('div');
            div.className = `timeline-item animate-on-scroll ${isLeft ? 'left' : 'right'}`;

            let carouselHTML = '';
            if (mediaArray.length > 0) {
                const escapedTitle = recuerdo.titulo.replace(/'/g, "\\'");
                if (mediaArray.length === 1) {
                    const item = mediaArray[0];
                    if (item.type === 'video') {
                        carouselHTML = `<video src="${item.url}" class="timeline-video" muted autoplay playsinline loop preload="metadata" onclick="window.openLightbox('${item.url}', '${escapedTitle}', 'video')"></video>`;
                    } else {
                        carouselHTML = `<img src="${item.url}" alt="" loading="lazy" style="cursor:pointer" onclick="window.openLightbox('${item.url}', '${escapedTitle}')">`;
                    }
                } else {
                    let itemsHTML = '';
                    let indicatorsHTML = '';
                    mediaArray.forEach((item, idx) => {
                        if (item.type === 'video') {
                            itemsHTML += `<video src="${item.url}" class="carousel-img ${idx === 0 ? 'active' : ''}" muted playsinline preload="metadata" data-type="video" onclick="window.openLightbox('${item.url}', '${escapedTitle}', 'video')"></video>`;
                        } else {
                            itemsHTML += `<img src="${item.url}" class="carousel-img ${idx === 0 ? 'active' : ''}" loading="lazy" data-type="image" onclick="window.openLightbox('${item.url}', '${escapedTitle}')">`;
                        }
                        indicatorsHTML += `<div class="indicator ${idx === 0 ? 'active' : ''}"></div>`;
                    });
                    carouselHTML = `
                    <div class="carousel-container" id="carousel-${recuerdo.id}" style="min-height: 250px; border-radius: 8px; margin-top:15px; cursor:pointer;" data-smart-carousel="true">
                        ${itemsHTML}
                        <div class="carousel-indicators">${indicatorsHTML}</div>
                    </div>`;
                }
            }

            div.innerHTML = `
                <div class="timeline-card">
                    <div class="card-actions">
                        <button class="action-btn" onclick="window.editarRecuerdo('${recuerdo.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn delete" onclick="window.eliminarRecuerdo('${recuerdo.id}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <span class="timeline-date">${fechaFormateada}</span>
                    <h3 class="timeline-title">${recuerdo.titulo}</h3>
                    ${recuerdo.descripcion ? `
                    <div class="expandable-text"
                         onmouseenter="this.classList.add('expanded')"
                         onmouseleave="if(!this.classList.contains('pinned')) this.classList.remove('expanded')"
                         onclick="this.classList.toggle('pinned'); this.classList.toggle('expanded', this.classList.contains('pinned') || false)">
                        <p class="timeline-content text-collapsed">${recuerdo.descripcion}</p>
                        <span class="read-more-btn"><i class="fa-solid fa-chevron-down"></i><span class="btn-label"></span></span>
                    </div>` : ''}
                    ${carouselHTML}
                </div>
            `;
            timeline.appendChild(div);
            isLeft = !isLeft;
        }

        // Render Gallery
        if (recuerdo.tipo === 'ambos' || recuerdo.tipo === 'foto' || recuerdo.tipo === 'video') {
            if (mediaArray.length > 0) {
                const dateObj = new Date(recuerdo.fecha + 'T00:00:00');
                const fechaFormateada = dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
                const anio = recuerdo.fecha.substring(0, 4);
                const escapedTitle = recuerdo.titulo.replace(/'/g, "\\'");
                const div = document.createElement('div');
                div.className = 'gallery-item';

                let galHTML = '';
                if (mediaArray.length === 1) {
                    const item = mediaArray[0];
                    if (item.type === 'video') {
                        galHTML = `<video src="${item.url}" class="gallery-video" muted autoplay playsinline loop preload="metadata" onclick="window.openLightbox('${item.url}', '${escapedTitle}', 'video')"></video>`;
                    } else {
                        galHTML = `<img src="${item.url}" alt="" loading="lazy" onclick="window.openLightbox('${item.url}', '${escapedTitle}')">`;
                    }
                } else {
                    let itemsHTML = '';
                    let indicatorsHTML = '';
                    mediaArray.forEach((item, idx) => {
                        if (item.type === 'video') {
                            itemsHTML += `<video src="${item.url}" class="carousel-img ${idx === 0 ? 'active' : ''}" muted playsinline data-type="video" onclick="window.openLightbox('${item.url}', '${escapedTitle}', 'video')"></video>`;
                        } else {
                            itemsHTML += `<img src="${item.url}" class="carousel-img ${idx === 0 ? 'active' : ''}" loading="lazy" data-type="image" onclick="window.openLightbox('${item.url}', '${escapedTitle}')">`;
                        }
                        indicatorsHTML += `<div class="indicator ${idx === 0 ? 'active' : ''}"></div>`;
                    });
                    galHTML = `
                    <div class="carousel-container" id="gal-carousel-${recuerdo.id}" data-smart-carousel="true">
                        ${itemsHTML}
                        <div class="carousel-indicators">${indicatorsHTML}</div>
                    </div>`;
                }

                div.innerHTML = `
                    ${galHTML}
                    <div class="gallery-caption">
                        <h4>${recuerdo.titulo}</h4>
                        <p>${anio}</p>
                        <p class="gallery-date">${fechaFormateada}</p>
                        <div class="gallery-actions">
                            <button class="action-btn" onclick="window.editarRecuerdo('${recuerdo.id}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="action-btn delete" onclick="window.eliminarRecuerdo('${recuerdo.id}')"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
                gallery.appendChild(div);
            }
        }
    });

    // Lógica para que giren los carruseles solos e inteligentes
    document.querySelectorAll('.carousel-container[data-smart-carousel="true"]').forEach(container => {
        iniciarCarruselInteligente(container);
    });

    // Activar observer para las nuevas tarjetas agregadas si es que hay scroll
    setTimeout(observeScroll, 100);
}

/**
 * Gestiona un carrusel que espera a los videos antes de pasar.
 */
function iniciarCarruselInteligente(container) {
    const items = container.querySelectorAll('.carousel-img');
    const indicators = container.querySelectorAll('.indicator');
    if (items.length <= 1) return;

    let currentIndex = 0;
    let timeout = null;

    function nextSlide() {
        if (timeout) clearTimeout(timeout);
        
        // Quitar estado anterior
        const prevItem = items[currentIndex];
        prevItem.classList.remove('active');
        if (prevItem.tagName === 'VIDEO') {
            prevItem.pause();
            prevItem.onended = null;
        }
        if (indicators[currentIndex]) indicators[currentIndex].classList.remove('active');

        // Calcular nuevo índice
        currentIndex = (currentIndex + 1) % items.length;

        // Activar nuevo ítem
        const currentItem = items[currentIndex];
        currentItem.classList.add('active');
        if (indicators[currentIndex]) indicators[currentIndex].classList.add('active');

        // Programar siguiente transición
        if (currentItem.tagName === 'VIDEO') {
            console.log("🎥 Reproduciendo video en carrusel...");
            currentItem.currentTime = 0;
            currentItem.muted = true; // El navegador requiere muted para autoplay
            currentItem.play().catch(e => console.warn("Fallo autoplay clip:", e));
            
            // Cuando termine el video, pasar al siguiente instantáneamente
            currentItem.onended = () => {
                console.log("🎬 Video terminado, saltando slide.");
                nextSlide();
            };
        } else {
            // Si es imagen, esperar 4 segundos
            timeout = setTimeout(nextSlide, 4500);
        }
    }

    // Iniciar el temporizador para el primer elemento si es imagen
    const firstItem = items[0];
    if (firstItem.tagName === 'VIDEO') {
        firstItem.play().catch(e => console.warn("Fallo autoplay inicial:", e));
        firstItem.onended = () => nextSlide();
    } else {
        timeout = setTimeout(nextSlide, 4500);
    }
}

// ==========================================
// 💖 CORAZONES FLOTANTES
// ==========================================
function createFloatingHearts() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const heartsContainer = document.createElement('div');
    heartsContainer.className = 'floating-hearts-container';
    hero.appendChild(heartsContainer); // Insertarlo en la vista principal

    // Función para crear un solo corazón
    function createSingleHeart() {
        if (!document.querySelector('.floating-hearts-container')) return;
        const heart = document.createElement('i');
        heart.classList.add('fa-solid', 'fa-heart', 'floating-heart');

        const left = Math.random() * 100; // Posición horizontal aleatoria
        const size = Math.random() * 1.5 + 0.5; // Tamaño aleatorio
        const duration = Math.random() * 8 + 8; // Entre 8 y 16 segundos

        // Estilos en línea
        heart.style.left = `${left}%`;
        heart.style.fontSize = `${size}rem`;
        heart.style.animationDuration = `${duration}s`;

        heartsContainer.appendChild(heart);

        // Cuando termine la animación, removerlo y crear otro
        setTimeout(() => {
            heart.remove();
            createSingleHeart();
        }, duration * 1000);
    }

    // Iniciar múltiples corazones con distintos retrasos
    const numHearts = 15;
    for (let i = 0; i < numHearts; i++) {
        setTimeout(createSingleHeart, Math.random() * 5000);
    }
}

// ==========================================
// 🔔 NOTIFICACIONES TOAST
// ==========================================
window.showToast = function (message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fa-solid fa-heart" style="color: var(--primary-color);"></i> <span>${message}</span>`;
    container.appendChild(toast);

    // Animar entrada
    setTimeout(() => toast.classList.add('show'), 10);

    // Animar salida
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400); // 400ms es lo que dura la transición CSS
    }, 3000);
}

// ==========================================
// 🔒 PANTALLA DE BLOQUEO Y CUMPLEAÑOS
// ==========================================
function setupBirthdayLock() {
    const lockScreen = document.getElementById("lock-screen");
    const massiveTimer = document.getElementById("massive-timer");
    const secretBtn = document.getElementById("secret-lock-btn");
    if (!lockScreen || !massiveTimer) return;

    // Lógica del "Backdoor" para desarrolladores
    let devClicks = 0;
    let devUnlocked = sessionStorage.getItem('devUnlocked') === 'true';

    if (secretBtn) {
        secretBtn.addEventListener('click', () => {
            devClicks++;
            if (devClicks >= 3) {
                devClicks = 0; // Reiniciar contador
                const pw = prompt("Modo Desarrollador. Ingresa la contraseña de pase:");
                if (pw === "Nuestroamorperdura") {
                    sessionStorage.setItem('devUnlocked', 'true');
                    devUnlocked = true;
                    unlockApp();
                    window.showToast("🔓 Acceso de Desarrollador Concedido");
                } else {
                    alert("❌ Contraseña Incorrecta");
                }
            }
        });
    }

    function unlockApp() {
        lockScreen.classList.add('unlocked');
        document.body.style.overflow = "auto"; // Restaurar scroll
        setTimeout(() => lockScreen.style.display = "none", 1000);
    }

    function lockApp() {
        if (!devUnlocked) {
            lockScreen.style.display = "flex";
            document.body.style.overflow = "hidden"; // Deshabilita scroll
        } else {
            lockScreen.style.display = "none";
            document.body.style.overflow = "auto";
        }
    }

    function update() {
        const now = new Date();
        const currentYear = now.getFullYear();
        // Cumpleaños: 12 de Abril
        let bday = new Date(currentYear, 3, 12, 0, 0, 0); 
        
        if (now > new Date(currentYear, 3, 13, 0, 0, 0)) {
            bday.setFullYear(currentYear + 1);
        }

        const diff = bday - now;

        // Si es el día de cumpleaños, desbloquear automáticamente simulando sorpresa
        if (now.getMonth() === 3 && now.getDate() === 12) {
            massiveTimer.innerHTML = "¡Feliz Cumpleaños mi amor! 🎉";
            massiveTimer.style.fontSize = window.innerWidth < 768 ? "2rem" : "4rem";
            massiveTimer.style.color = "var(--accent-color)";
            if(!devUnlocked) {
                // Al llegar el momento, se queda congelado 3 segundos para celebrar, y desbloquea el sitio
                setTimeout(unlockApp, 3500); 
                devUnlocked = true; // Impedir que se vuelva a bloquear en este F5
            }
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        massiveTimer.innerText = `${d.toString().padStart(2, '0')}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    }

    lockApp();
    update();
    // Actualizar 1 vez por segundo solo si está bloqueado, para ahorrar batería si está desbloqueado
    setInterval(() => {
        if (!devUnlocked || (now => now.getMonth() === 3 && now.getDate() === 12)()) {
            update();
        }
    }, 1000);
}

// ==========================================
// 🧭 NAVBAR INTELIGENTE (SCROLL HIDE)
// ==========================================
function setupSmartNavbar() {
    let lastScrollY = window.scrollY;
    const navbar = document.querySelector('.navbar');

    if (!navbar) return;

    window.addEventListener('scroll', () => {
        // En móviles, a veces el scroll elástico da valores negativos
        if (window.scrollY <= 0) {
            navbar.classList.remove('nav-hidden');
            return;
        }

        // Si bajamos, ocultar. Si subimos, mostrar.
        if (window.scrollY > lastScrollY && window.scrollY > 80) {
            navbar.classList.add('nav-hidden');
        } else {
            navbar.classList.remove('nav-hidden');
        }
        lastScrollY = window.scrollY;
    }, { passive: true });
}


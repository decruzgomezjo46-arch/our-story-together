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
let app, db;
try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("🔥 Firebase activado con éxito!");
} catch (e) {
    console.error("Error inicializando Firebase:", e);
}

// Variables Globales
let recuerdos = [];
let editandoId = null;
let currentPhotosArray = []; // Arreglo para múltiples fotos
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
    lightbox.onclick = (e) => {
        if (e.target === lightbox) lightbox.style.display = "none";
    };

    window.openLightbox = function (src, title) {
        document.getElementById('lightbox-img').src = src;
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
        dropArea.style.display = 'none';
        previewContainer.style.display = 'flex';

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            if (currentPhotosArray.length >= 10) {
                alert("Has alcanzado el límite máximo de 10 fotos por recuerdo.");
                break;
            }

            try {
                const compressedBase64 = await resizeAndCompressImage(file);

                // Validar que el tamaño total no exceda el límite de ~1MB de Firestore
                const currentSizeApprox = JSON.stringify(currentPhotosArray).length;
                const newAddedSize = compressedBase64.length;

                // Firestore tiene un límite de 1MB (1,048,576 bytes) por documento. 
                // Dejamos un margen de ~100KB para el texto y otras propiedades del recuerdo.
                if (currentSizeApprox + newAddedSize > 900000) {
                    alert(`No se pudo añadir la foto "${file.name}" porque el recuerdo supera el tamaño máximo permitido (1MB). Intenta con menos fotos.`);
                    continue;
                }

                currentPhotosArray.push(compressedBase64);
                renderMiniatures();
            } catch (err) {
                console.error("Error al comprimir:", err);
            }
        }
    }
}

function renderMiniatures() {
    const container = document.getElementById('imagePreviewContainer');
    container.innerHTML = '';

    if (currentPhotosArray.length === 0) {
        container.style.display = 'none';
        document.getElementById('dragDropArea').style.display = 'block';
        return;
    }

    currentPhotosArray.forEach((b64, index) => {
        const div = document.createElement('div');
        div.className = 'mini-preview';
        div.innerHTML = `
            <img src="${b64}">
            <button type="button" class="remove-mini" onclick="window.removeMiniature(${index})"><i class="fa-solid fa-xmark"></i></button>
        `;
        container.appendChild(div);
    });
}

window.removeMiniature = function (index) {
    currentPhotosArray.splice(index, 1);
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
                resolve(canvas.toDataURL('image/jpeg', 0.6)); // Mayor compresión a JPG para evitar error de 1MB
            };
            img.onerror = err => reject(err);
            img.src = event.target.result;
        };
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });
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
    currentPhotosArray = [];
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
    const hasFotos = recuerdo.fotos && recuerdo.fotos.length > 0;
    const hasOldFoto = recuerdo.foto;

    if (hasFotos) {
        currentPhotosArray = [...recuerdo.fotos];
    } else if (hasOldFoto) {
        currentPhotosArray = [recuerdo.foto];
    }

    if (currentPhotosArray.length > 0) {
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

    gDesc.style.display = (tipo === 'foto') ? 'none' : 'block';
    gFoto.style.display = (tipo === 'historia') ? 'none' : 'block';
}

function setupForm() {
    const form = document.getElementById('uploadForm');
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const saveBtn = form.querySelector('.btn-submit');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            const tipo = document.getElementById('tipoRecuerdo').value;
            if ((tipo === 'ambos' || tipo === 'foto') && currentPhotosArray.length === 0) {
                alert('Por favor agrega al menos una fotografía.');
                return;
            }

            const data = {
                tipo: tipo,
                titulo: document.getElementById('titulo').value,
                fecha: document.getElementById('fecha').value,
                descripcion: document.getElementById('descripcion').value || '',
                fotos: currentPhotosArray
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
        // Normalizar fotos (Compatibilidad vieja)
        const fotosArray = recuerdo.fotos ? recuerdo.fotos : (recuerdo.foto ? [recuerdo.foto] : []);

        // Render Timeline
        if (recuerdo.tipo === 'ambos' || recuerdo.tipo === 'historia') {
            const dateObj = new Date(recuerdo.fecha + 'T00:00:00');
            const fechaFormateada = dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

            const div = document.createElement('div');
            // Agregamos animate-on-scroll para el efecto
            div.className = `timeline-item animate-on-scroll ${isLeft ? 'left' : 'right'}`;

            let carouselHTML = '';
            if (fotosArray.length > 0) {
                const escapedTitle = recuerdo.titulo.replace(/'/g, "\\'");
                if (fotosArray.length === 1) {
                    carouselHTML = `<img src="${fotosArray[0]}" alt="" loading="lazy" style="cursor:pointer" onclick="window.openLightbox('${fotosArray[0]}', '${escapedTitle}')">`;
                } else {
                    let imagesHTML = '';
                    let indicatorsHTML = '';
                    fotosArray.forEach((foto, idx) => {
                        imagesHTML += `<img src="${foto}" class="carousel-img ${idx === 0 ? 'active' : ''}" loading="lazy" onclick="window.openLightbox('${foto}', '${escapedTitle}')">`;
                        indicatorsHTML += `<div class="indicator ${idx === 0 ? 'active' : ''}"></div>`;
                    });
                    carouselHTML = `
                    <div class="carousel-container" style="min-height: 250px; border-radius: 8px; margin-top:15px; cursor:pointer;" data-interval="true">
                        ${imagesHTML}
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
                    <p class="timeline-content">${recuerdo.descripcion}</p>
                    ${carouselHTML}
                </div>
            `;
            timeline.appendChild(div);
            isLeft = !isLeft;
        }

        // Render Gallery
        if (recuerdo.tipo === 'ambos' || recuerdo.tipo === 'foto') {
            if (fotosArray.length > 0) {
                const dateObj = new Date(recuerdo.fecha + 'T00:00:00');
                const fechaFormateada = dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
                const anio = recuerdo.fecha.substring(0, 4);
                const escapedTitle = recuerdo.titulo.replace(/'/g, "\\'");
                const div = document.createElement('div');
                div.className = 'gallery-item';

                let galHTML = '';
                if (fotosArray.length === 1) {
                    galHTML = `<img src="${fotosArray[0]}" alt="" loading="lazy" onclick="window.openLightbox('${fotosArray[0]}', '${escapedTitle}')">`;
                } else {
                    let imagesHTML = '';
                    let indicatorsHTML = '';
                    fotosArray.forEach((foto, idx) => {
                        imagesHTML += `<img src="${foto}" class="carousel-img ${idx === 0 ? 'active' : ''}" loading="lazy" onclick="window.openLightbox('${foto}', '${escapedTitle}')">`;
                        indicatorsHTML += `<div class="indicator ${idx === 0 ? 'active' : ''}"></div>`;
                    });
                    galHTML = `
                    <div class="carousel-container" data-interval="true">
                        ${imagesHTML}
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

    // Lógica para que giren los carruseles solos
    document.querySelectorAll('.carousel-container[data-interval="true"]').forEach(container => {
        const images = container.querySelectorAll('.carousel-img');
        const indicators = container.querySelectorAll('.indicator');
        if (images.length > 1) {
            let currentIndex = 0;
            setInterval(() => {
                images[currentIndex].classList.remove('active');
                if (indicators[currentIndex]) indicators[currentIndex].classList.remove('active');

                currentIndex = (currentIndex + 1) % images.length;

                images[currentIndex].classList.add('active');
                if (indicators[currentIndex]) indicators[currentIndex].classList.add('active');
            }, 3500); // 3.5 Segundos por slide
        }
    });

    // Activar observer para las nuevas tarjetas agregadas si es que hay scroll
    setTimeout(observeScroll, 100);
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

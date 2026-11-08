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

// ==========================================
// 🧪 SEPARACIÓN DE DATOS: LOCAL vs PRODUCCIÓN
// ==========================================
// Si abres la app desde localhost o file://, se usa la colección "recuerdos_dev"
// para que tus pruebas NUNCA toquen los recuerdos reales de producción.
const isLocalEnv = ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol === 'file:';
// 👀 Truco: abrir en local con "?prod=1" en la URL muestra los datos REALES
// en modo SOLO LECTURA. Sin ese parámetro, local siempre usa pruebas (recuerdos_dev).
const previewRealData = new URLSearchParams(location.search).has('prod');
const COLLECTION_NAME = (isLocalEnv && !previewRealData) ? 'recuerdos_dev' : 'recuerdos';
const READ_ONLY_PREVIEW = isLocalEnv && previewRealData;
// Colección de sueños: sigue la misma separación local/producción que los recuerdos
const DREAMS_COLLECTION = COLLECTION_NAME === 'recuerdos' ? 'suenos' : 'suenos_dev';

// ==========================================
// 🔐 CONTRASEÑA (SHA-256, no texto plano)
// ==========================================
// Hash SHA-256 de la contraseña. Para cambiarla, genera el nuevo hash:
// PowerShell: $b=[Text.Encoding]::UTF8.GetBytes("NUEVAPASS"); ($([Security.Cryptography.SHA256]::Create()).ComputeHash($b)|%{$_.ToString('x2')}) -join ''
const PASSWORD_SHA256 = "4b70b7ab0264593fb1db7854c29555bb908ea4fcc3d2c231f78f8c610e2a9cd2";

async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkPassword(input) {
    if (input === null || input === undefined) return false;
    try {
        return (await sha256Hex(input)) === PASSWORD_SHA256;
    } catch (e) {
        console.error("crypto.subtle no disponible. Usa localhost o https.", e);
        alert("Error de seguridad del navegador. Sirve la app desde un servidor local (Live Server) en lugar de abrir el archivo directo.");
        return false;
    }
}

// ==========================================
// 🔐 PANTALLA DE ACCESO INICIAL (FECHA: 03/11/26)
// ==========================================
// Se guardan hashes SHA-256 de la fecha normalizada (solo dígitos), con y sin
// ceros a la izquierda y con año de 2 o 4 cifras. Así funcionan tanto "03/11/26"
// como "3/11/26" o "03-11-2026", sin guardar la contraseña en texto plano.
const ACCESS_PASSWORD_SHA256 = [
    "4116cd1e4f6671e0e2ccd5f76bb0c93cc586c71b0137b02aba30978c0e77d9ec", // 031126
    "f128b92e59604af6a665b9e18cf102dd66c237294cc3c057fabe3c897bf57ea6", // 31126
    "53130b2c399cb37d8c17291f2a08c7940ecad7d1dbf942c87d1c1a4ce75f720c", // 03112026
    "2d24dfc45f9a9991392cb46e3ba36d4622c9ada40cfa7699ca0d9a229b7f4b86"  // 3112026
];
const ACCESS_SESSION_KEY = 'historiaAcceso';

function normalizeAccessPassword(input) {
    return String(input ?? '').replace(/\D/g, '');
}

async function checkAccessPassword(input) {
    const digits = normalizeAccessPassword(input);
    if (!digits) return false;
    try {
        const hash = await sha256Hex(digits);
        return ACCESS_PASSWORD_SHA256.includes(hash);
    } catch (e) {
        console.error("crypto.subtle no disponible. Usa localhost o https.", e);
        return false;
    }
}

// ==========================================
// 🛡️ HELPERS ANTI-XSS
// ==========================================
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Para valores dentro de onclick="...'${...}'..." (HTML attr + string JS)
function escapeAttr(value) {
    return escapeHtml(
        String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/\r?\n/g, ' ')
    );
}

// Variables Globales
let recuerdos = [];
let editandoId = null;
let currentMediaArray = []; // Arreglo para múltiples fotos y videos {file, type, preview}
let currentFilterYear = 'Todos';
let currentSearchTerm = '';

// Estado de Sueños ✨
let suenos = [];
let editandoSuenoId = null;

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
    const audioBtn = document.getElementById('audio-toggle-btn');
    const audioText = document.getElementById('audio-text-nav');
    
    if (!audio || !audioBtn) return;

    // Audio initial state
    audio.volume = 0.5;

    audioBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play().catch(e => console.log('El navegador silenció el video', e));
            audioBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span id="audio-text-nav">Pausar</span>';
        } else {
            audio.pause();
            audioBtn.innerHTML = '<i class="fa-solid fa-music"></i> <span id="audio-text-nav">Música</span>';
        }
    });

    // Inyectar evento para sincronizar si el audio se reproduce desde otro lado
    audio.addEventListener('play', () => {
        if(audioBtn) audioBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span id="audio-text-nav">Pausar</span>';
    });
    audio.addEventListener('pause', () => {
        if(audioBtn) audioBtn.innerHTML = '<i class="fa-solid fa-music"></i> <span id="audio-text-nav">Música</span>';
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
    // 🧹 Limpieza y Parches de Seguridad
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            for(let registration of registrations) {
                registration.unregister();
                console.log('✅ Service Worker antiguo (coi-serviceworker) desinstalado correctamente.');
            }
        });
    }

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
    setupAccessLock();
    setupBirthdayLock();
    setupDreams();

    // Cargar datos
    if (isFirebaseConfigured) {
        // Escucha en tiempo real de Firebase
        db.collection(COLLECTION_NAME).onSnapshot((snapshot) => {
            recuerdos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            aplicarFiltrosYRenderizar();
        });
        if (READ_ONLY_PREVIEW) {
            window.showToast('👀 Vista previa de datos REALES (solo lectura)');
        } else if (isLocalEnv) {
            console.log('🧪 Modo LOCAL: usando colección de prueba "' + COLLECTION_NAME + '". Tus datos reales están a salvo.');
        }
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
let globalScrollObserver = null;
let globalVideoObserver = null;

function observeScroll() {
    if (!globalScrollObserver) {
        globalScrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });
    }

    if (!globalVideoObserver) {
        globalVideoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                if (video.id === 'lightbox-video') return; 
                
                if (entry.isIntersecting) {
                    if (video.paused && (video.classList.contains('timeline-video') || video.classList.contains('gallery-video') || video.classList.contains('active'))) {
                        video.play().catch(e => {}); // Silenciado para evitar ruido en consola
                    }
                } else {
                    if (!video.paused) {
                        video.pause();
                    }
                }
            });
        }, { threshold: 0.3 });
    }

    // 1. Matar radares fantasma anteriores
    globalScrollObserver.disconnect();
    globalVideoObserver.disconnect();

    // 2. Reconectar a todos los nodos actualizados en el DOM
    document.querySelectorAll('.animate-on-scroll').forEach(el => globalScrollObserver.observe(el));
    document.querySelectorAll('video').forEach(video => {
        globalVideoObserver.observe(video);
    });
}

function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    const closeBtn = document.querySelector('.lightbox-close');

    if (!lightbox) return;

    closeBtn.onclick = () => {
        lightbox.style.display = "none";
        const video = document.getElementById('lightbox-video');
        if(video) video.pause();
    };
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
            video.pause(); // Detener video si estaba sonando
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

window.editarRecuerdo = async function (id) {
    if (READ_ONLY_PREVIEW) { alert('👀 Modo vista previa (?prod=1): la edición está bloqueada para proteger los datos reales.'); return; }
    const pass = prompt("Por seguridad, introduce la contraseña para editar:");
    if (!(await checkPassword(pass))) {
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
    if (READ_ONLY_PREVIEW) { alert('👀 Modo vista previa (?prod=1): el borrado está bloqueado para proteger los datos reales.'); return; }
    const pass = prompt("Por seguridad, introduce la contraseña para eliminar.");
    if (!(await checkPassword(pass))) {
        if (pass !== null) alert("Contraseña incorrecta.");
        return;
    }

    if (confirm("¿Estás seguro de que deseas eliminar este recuerdo para siempre?")) {
        if (isFirebaseConfigured) {
            await db.collection(COLLECTION_NAME).doc(id).delete();
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
    const dreamModal = document.getElementById('dreamModal');
    if (event.target == dreamModal) window.closeDreamModal();
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
        if (READ_ONLY_PREVIEW) {
            alert('👀 Modo vista previa (?prod=1): guardar está bloqueado para proteger los datos reales.');
            return;
        }
        const saveBtn = form.querySelector('.btn-submit');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            const tipo = document.getElementById('tipoRecuerdo').value;
            const filesToUpload = [];

            if (tipo === 'ambos' || tipo === 'foto' || tipo === 'video') {
                if (currentMediaArray.length === 0) {
                    alert('Por favor agrega al menos un archivo multimedia.');
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = 'Guardar para siempre <i class="fa-solid fa-heart"></i>';
                    return;
                }

                // Proceso de compresión y subida masiva concurrente
                saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Procesando archivos...`;
                
                const uploadPromises = currentMediaArray.map(async (item) => {
                    // Si el archivo ya está subido a la nube (es decir, estamos editando un recuerdo), retener los datos
                    if (item.url && !item.file) {
                        return { url: item.url, type: item.type };
                    }

                    let blob = item.file; // Por defecto el original

                    if (item.type === 'image') {
                        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Comprimiendo localmente...`;
                        blob = await resizeAndCompressImage(item.file);
                    }
                    
                    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Subiendo a la Nube en Paralelo...`;
                    try {
                        const url = await uploadToCloudinary(blob, item.file.name, item.type);
                        if (!url) throw new Error(`Fallo al subir el archivo ${item.file.name}`);
                        return { url, type: item.type };
                    } catch (uploadErr) {
                        console.error("❌ Error en Cloudinary:", uploadErr);
                        throw new Error("Error al subir a Cloudinary: " + uploadErr.message);
                    }
                });

                try {
                    const uploadedFiles = await Promise.all(uploadPromises);
                    filesToUpload.push(...uploadedFiles);
                } catch(e) {
                    alert(e.message);
                    throw e; // Romper el ciclo de guardado para que no guarde a medias
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
                    await db.collection(COLLECTION_NAME).doc(editandoId).update(data);
                } else {
                    await db.collection(COLLECTION_NAME).add(data);
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

        // Optimizar y transcodificar recursos multimedia de Cloudinary de forma inteligente
        mediaArray = mediaArray.map(item => {
            let optUrl = item.url;
            let originalUrl = item.url;
            if (optUrl && typeof optUrl === 'string' && optUrl.includes('res.cloudinary.com') && optUrl.includes('/upload/') && !optUrl.includes('q_auto')) {
                const isVideo = item.type === 'video' || optUrl.match(/\.(mp4|webm|mov|mkv)$/i);
                if (isVideo) {
                    optUrl = optUrl.replace('/upload/', '/upload/q_auto,f_mp4,vc_h264,w_700,c_limit/');
                } else {
                    optUrl = optUrl.replace('/upload/', '/upload/q_auto,f_auto,w_800,c_limit/');
                }
            }
            return { ...item, url: optUrl, originalUrl: originalUrl, type: item.type || (optUrl.match(/\.(mp4|webm|mov|mkv)$/i) ? 'video' : 'image') };
        });

        // Render Timeline
        if (recuerdo.tipo === 'ambos' || recuerdo.tipo === 'historia' || recuerdo.tipo === 'video') {
            const dateObj = new Date(recuerdo.fecha + 'T00:00:00');
            const fechaFormateada = dateObj.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            const titleHtml = escapeHtml(recuerdo.titulo);
            const safeId = escapeAttr(recuerdo.id);

            const div = document.createElement('div');
            div.className = `timeline-item animate-on-scroll ${isLeft ? 'left' : 'right'}`;

            let carouselHTML = '';
            if (mediaArray.length > 0) {
                const titleJs = escapeAttr(recuerdo.titulo);
                if (mediaArray.length === 1) {
                    const item = mediaArray[0];
                    if (item.type === 'video') {
                        carouselHTML = `<video src="${escapeHtml(item.url)}" class="timeline-video" muted playsinline loop preload="none" onclick="window.openLightbox('${escapeAttr(item.originalUrl)}', '${titleJs}', 'video')"></video>`;
                    } else {
                        carouselHTML = `<img src="${escapeHtml(item.url)}" alt="" loading="lazy" style="cursor:pointer" onclick="window.openLightbox('${escapeAttr(item.originalUrl)}', '${titleJs}')">`;
                    }
                } else {
                    let itemsHTML = '';
                    let indicatorsHTML = '';
                    mediaArray.forEach((item, idx) => {
                        if (item.type === 'video') {
                            itemsHTML += `<video src="${escapeHtml(item.url)}" class="carousel-img ${idx === 0 ? 'active' : ''}" muted playsinline preload="none" data-type="video" onclick="window.openLightbox('${escapeAttr(item.originalUrl)}', '${titleJs}', 'video')"></video>`;
                        } else {
                            itemsHTML += `<img src="${escapeHtml(item.url)}" class="carousel-img ${idx === 0 ? 'active' : ''}" loading="lazy" data-type="image" onclick="window.openLightbox('${escapeAttr(item.originalUrl)}', '${titleJs}')">`;
                        }
                        indicatorsHTML += `<div class="indicator ${idx === 0 ? 'active' : ''}"></div>`;
                    });
                    carouselHTML = `
                    <div class="carousel-container" id="carousel-${safeId}" style="min-height: 250px; border-radius: 8px; margin-top:15px; cursor:pointer;" data-smart-carousel="true">
                        ${itemsHTML}
                        <div class="carousel-indicators">${indicatorsHTML}</div>
                    </div>`;
                }
            }

            div.innerHTML = `
                <div class="timeline-card">
                    ${READ_ONLY_PREVIEW ? '' : `
                    <div class="card-actions">
                        <button class="action-btn" onclick="window.editarRecuerdo('${safeId}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        <button class="action-btn delete" onclick="window.eliminarRecuerdo('${safeId}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                    </div>`}
                    <span class="timeline-date">${fechaFormateada}</span>
                    <h3 class="timeline-title">${titleHtml}</h3>
                    ${recuerdo.descripcion ? `
                    <div class="expandable-text"
                         onmouseenter="this.classList.add('expanded')"
                         onmouseleave="if(!this.classList.contains('pinned')) this.classList.remove('expanded')"
                         onclick="this.classList.toggle('pinned'); this.classList.toggle('expanded', this.classList.contains('pinned') || false)">
                        <p class="timeline-content text-collapsed">${escapeHtml(recuerdo.descripcion)}</p>
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
                const titleHtml = escapeHtml(recuerdo.titulo);
                const titleJs = escapeAttr(recuerdo.titulo);
                const safeId = escapeAttr(recuerdo.id);
                const div = document.createElement('div');
                div.className = 'gallery-item';

                let galHTML = '';
                if (mediaArray.length === 1) {
                    const item = mediaArray[0];
                    if (item.type === 'video') {
                        galHTML = `<video src="${escapeHtml(item.url)}" class="gallery-video" muted playsinline loop preload="none" onclick="window.openLightbox('${escapeAttr(item.originalUrl)}', '${titleJs}', 'video')"></video>`;
                    } else {
                        galHTML = `<img src="${escapeHtml(item.url)}" alt="" loading="lazy" onclick="window.openLightbox('${escapeAttr(item.originalUrl)}', '${titleJs}')">`;
                    }
                } else {
                    let itemsHTML = '';
                    let indicatorsHTML = '';
                    mediaArray.forEach((item, idx) => {
                        if (item.type === 'video') {
                            itemsHTML += `<video src="${escapeHtml(item.url)}" class="carousel-img ${idx === 0 ? 'active' : ''}" muted playsinline preload="none" data-type="video" onclick="window.openLightbox('${escapeAttr(item.originalUrl)}', '${titleJs}', 'video')"></video>`;
                        } else {
                            itemsHTML += `<img src="${escapeHtml(item.url)}" class="carousel-img ${idx === 0 ? 'active' : ''}" loading="lazy" data-type="image" onclick="window.openLightbox('${escapeAttr(item.originalUrl)}', '${titleJs}')">`;
                        }
                        indicatorsHTML += `<div class="indicator ${idx === 0 ? 'active' : ''}"></div>`;
                    });
                    galHTML = `
                    <div class="carousel-container" id="gal-carousel-${safeId}" data-smart-carousel="true">
                        ${itemsHTML}
                        <div class="carousel-indicators">${indicatorsHTML}</div>
                    </div>`;
                }

                div.innerHTML = `
                    ${galHTML}
                    <div class="gallery-caption">
                        <h4>${titleHtml}</h4>
                        <p>${escapeHtml(anio)}</p>
                        <p class="gallery-date">${fechaFormateada}</p>
                        ${READ_ONLY_PREVIEW ? '' : `
                        <div class="gallery-actions">
                            <button class="action-btn" onclick="window.editarRecuerdo('${safeId}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="action-btn delete" onclick="window.eliminarRecuerdo('${safeId}')"><i class="fa-solid fa-trash"></i></button>
                        </div>`}
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
            currentItem.play().catch(e => {
                console.warn("Fallo autoplay clip:", e);
                // Fallback si el dispositivo bloquea el video por ahorro de energía
                timeout = setTimeout(nextSlide, 4500);
            });
            
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
        firstItem.muted = true;
        firstItem.play().catch(e => {
            console.warn("Fallo autoplay inicial:", e);
            timeout = setTimeout(nextSlide, 4500);
        });
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
// ✨ NUESTROS SUEÑOS
// ==========================================
function formatearFechaCorta(iso) {
    try {
        return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
        return iso || '';
    }
}

function setupDreams() {
    if (!isFirebaseConfigured) return;

    // Sincronización en tiempo real
    db.collection(DREAMS_COLLECTION).onSnapshot((snapshot) => {
        suenos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderDreams();
    });
    if (isLocalEnv && !READ_ONLY_PREVIEW) {
        console.log('🧪 Sueños locales usando colección "' + DREAMS_COLLECTION + '".');
    }

    // Formulario
    const form = document.getElementById('dreamForm');
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (READ_ONLY_PREVIEW) {
            alert('👀 Modo vista previa (?prod=1): guardar está bloqueado para proteger los datos reales.');
            return;
        }

        const titulo = document.getElementById('sueno-titulo').value.trim();
        const descripcion = document.getElementById('sueno-descripcion').value.trim();
        if (!titulo) return;

        try {
            if (editandoSuenoId) {
                // Solo actualizar texto: conservar estado cumplido intacto
                await db.collection(DREAMS_COLLECTION).doc(editandoSuenoId).update({ titulo, descripcion });
                window.showToast('Sueño actualizado ✨');
            } else {
                await db.collection(DREAMS_COLLECTION).add({
                    titulo,
                    descripcion,
                    cumplido: false,
                    fechaCumplido: null
                });
                window.showToast('Nuevo sueño agregado ✨');
            }
            window.closeDreamModal();
        } catch (err) {
            alert('Error al guardar el sueño: ' + err.message);
        }
    });
}

function renderDreams() {
    const container = document.getElementById('dreams-container');
    const emptyEl = document.getElementById('empty-dreams');
    if (!container) return;
    container.innerHTML = '';

    // Barra de progreso compartida
    const total = suenos.length;
    const cumplidos = suenos.filter(s => s.cumplido).length;
    const label = document.getElementById('dreams-progress-label');
    const fill = document.getElementById('dreams-progress-fill');
    if (label) label.innerHTML = `<i class="fa-solid fa-star"></i> Cumplimos ${cumplidos} de ${total} sueños`;
    if (fill) fill.style.width = total ? Math.round((cumplidos / total) * 100) + '%' : '0%';

    if (total === 0) {
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';

    // Pendientes primero para mantenerlos visibles y motivadores
    const sorted = [...suenos].sort((a, b) => (a.cumplido === b.cumplido) ? 0 : (a.cumplido ? 1 : -1));

    sorted.forEach(s => {
        const safeId = escapeAttr(s.id);
        const div = document.createElement('div');
        div.className = 'dream-card' + (s.cumplido ? ' fulfilled' : '');

        const checkIcon = s.cumplido ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-regular fa-heart"></i>';
        const checkTitle = s.cumplido ? 'Marcar como pendiente' : '¡Lo logramos! Marcar como cumplido';
        const badge = s.cumplido
            ? `<span class="dream-badge done"><i class="fa-solid fa-check"></i> Hecho realidad${s.fechaCumplido ? ' · ' + escapeHtml(formatearFechaCorta(s.fechaCumplido)) : ''}</span>`
            : `<span class="dream-badge pending"><i class="fa-regular fa-clock"></i> Por cumplir</span>`;

        div.innerHTML = `
            ${READ_ONLY_PREVIEW ? '' : `
            <div class="card-actions">
                <button class="action-btn" onclick="window.editarSueno('${safeId}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="action-btn delete" onclick="window.eliminarSueno('${safeId}')" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
            </div>`}
            <button type="button" class="dream-check ${s.cumplido ? 'on' : ''}" onclick="window.toggleSueno('${safeId}')" title="${checkTitle}">
                ${checkIcon}
            </button>
            <h3 class="dream-title">${escapeHtml(s.titulo)}</h3>
            ${s.descripcion ? `<p class="dream-desc">${escapeHtml(s.descripcion)}</p>` : ''}
            ${badge}
        `;
        container.appendChild(div);
    });
}

window.openDreamModal = function () {
    if (READ_ONLY_PREVIEW) { alert('👀 Modo vista previa (?prod=1): agregar sueños está bloqueado.'); return; }
    editandoSuenoId = null;
    document.getElementById('dreamModal').style.display = 'block';
    document.getElementById('dreamForm').reset();
}

window.closeDreamModal = function () {
    document.getElementById('dreamModal').style.display = 'none';
}

window.editarSueno = async function (id) {
    if (READ_ONLY_PREVIEW) { alert('👀 Modo vista previa (?prod=1): la edición está bloqueada.'); return; }
    const pass = prompt("Contraseña para editar este sueño:");
    if (!(await checkPassword(pass))) {
        if (pass !== null) alert("Contraseña incorrecta.");
        return;
    }

    const sueno = suenos.find(x => x.id === id);
    if (!sueno) return;

    editandoSuenoId = id;
    document.getElementById('sueno-titulo').value = sueno.titulo || '';
    document.getElementById('sueno-descripcion').value = sueno.descripcion || '';
    document.getElementById('dreamModal').style.display = 'block';
}

window.eliminarSueno = async function (id) {
    if (READ_ONLY_PREVIEW) { alert('👀 Modo vista previa (?prod=1): el borrado está bloqueado.'); return; }
    const pass = prompt("Contraseña para eliminar este sueño:");
    if (!(await checkPassword(pass))) {
        if (pass !== null) alert("Contraseña incorrecta.");
        return;
    }

    if (confirm("¿Eliminar este sueño para siempre?")) {
        try {
            await db.collection(DREAMS_COLLECTION).doc(id).delete();
            window.showToast("Sueño eliminado");
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    }
}

window.toggleSueno = async function (id) {
    if (READ_ONLY_PREVIEW) { alert('👀 Modo vista previa (?prod=1): cambios bloqueados.'); return; }
    const sueno = suenos.find(s => s.id === id);
    if (!sueno) return;

    const nuevoEstado = !sueno.cumplido;
    try {
        await db.collection(DREAMS_COLLECTION).doc(id).update({
            cumplido: nuevoEstado,
            fechaCumplido: nuevoEstado ? new Date().toISOString().substring(0, 10) : null
        });
        if (nuevoEstado) {
            celebrate();
            window.showToast('¡Un sueño más hecho realidad! 💖');
        }
    } catch (err) {
        alert('Error al actualizar: ' + err.message);
    }
}

// Lluvia global de corazones/estrellas (para celebrar logros)
function celebrate(count = 45) {
    const container = document.createElement('div');
    container.className = 'celebration-overlay';
    document.body.appendChild(container);

    const emojis = ['💗', '✨', '💖', '⭐', '🐢'];
    for (let i = 0; i < count; i++) {
        const p = document.createElement('span');
        p.className = 'party-heart';
        p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        p.style.left = Math.random() * 100 + '%';
        p.style.fontSize = (Math.random() * 1.6 + 1) + 'rem';
        p.style.animationDuration = (Math.random() * 2 + 2.5) + 's';
        p.style.animationDelay = (Math.random() * 0.8) + 's';
        container.appendChild(p);
    }

    setTimeout(() => container.remove(), 6000);
}

// ==========================================
// 🔐 PANTALLA DE ACCESO INICIAL
// ==========================================
function setupAccessLock() {
    const overlay = document.getElementById('access-lock');
    const form = document.getElementById('access-lock-form');
    const input = document.getElementById('access-lock-input');
    const errorEl = document.getElementById('access-lock-error');
    const card = overlay ? overlay.querySelector('.access-lock-card') : null;
    if (!overlay || !form || !input) return;

    // Si ya se abrió en esta pestaña, no volver a pedir la contraseña.
    let granted = false;
    try { granted = sessionStorage.getItem(ACCESS_SESSION_KEY) === 'abierto'; } catch (e) { }
    if (granted) {
        document.documentElement.classList.add('access-granted');
        overlay.remove();
        return;
    }

    // Enfocar el campo sin provocar saltos de scroll en móvil.
    setTimeout(() => {
        try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    }, 350);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const value = input.value;

        if (!normalizeAccessPassword(value)) {
            if (errorEl) errorEl.textContent = 'Escribe la fecha para continuar.';
            input.focus();
            return;
        }

        // crypto.subtle solo existe en contextos seguros (https o localhost).
        if (!window.crypto || !window.crypto.subtle) {
            if (errorEl) errorEl.textContent = 'Abre la página desde https o localhost para poder validar la fecha.';
            return;
        }

        const ok = await checkAccessPassword(value);
        if (!ok) {
            if (errorEl) errorEl.textContent = 'Esa no es la fecha. Inténtalo de nuevo.';
            input.value = '';
            input.focus();
            if (card) {
                card.classList.remove('shake');
                void card.offsetWidth; // Reinicia la animación
                card.classList.add('shake');
            }
            return;
        }

        if (errorEl) errorEl.textContent = '';
        try { sessionStorage.setItem(ACCESS_SESSION_KEY, 'abierto'); } catch (e) { }

        // Desvanecer y retirar la pantalla de acceso.
        overlay.classList.add('access-lock-opening');
        setTimeout(() => {
            overlay.remove();
            document.documentElement.classList.add('access-granted');
        }, 600);
    });

    // Si el navegador restaura la página desde caché, respetar el acceso ya concedido.
    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) return;
        let stillGranted = false;
        try { stillGranted = sessionStorage.getItem(ACCESS_SESSION_KEY) === 'abierto'; } catch (e) { }
        if (stillGranted) {
            document.documentElement.classList.add('access-granted');
            const currentOverlay = document.getElementById('access-lock');
            if (currentOverlay) currentOverlay.remove();
        }
    });
}

// ==========================================
// 🔒 PANTALLA DE BLOQUEO Y CUMPLEAÑOS
// ==========================================
function setupBirthdayLock() {
    const lockScreen = document.getElementById("lock-screen");
    const massiveTimer = document.getElementById("massive-timer");
    const secretBtn = document.getElementById("secret-lock-btn");
    if (!lockScreen || !massiveTimer) return;

    // 🌟 MODO PRUEBA: Cambia a "false" para el día real. Si es "true", el contador dura 30 segundos exactos.
    const MODO_PRUEBA = false; 
    let testBdayDate = null;
    if (MODO_PRUEBA) {
        testBdayDate = new Date();
        testBdayDate.setSeconds(testBdayDate.getSeconds() + 30);
    }

    // Lógica del "Backdoor" para desarrolladores
    let devClicks = 0;
    let devUnlocked = sessionStorage.getItem('devUnlocked') === 'true';

    if (secretBtn) {
        secretBtn.addEventListener('click', async () => {
            devClicks++;
            if (devClicks >= 3) {
                devClicks = 0; // Reiniciar contador
                const pw = prompt("Modo Desarrollador. Ingresa la contraseña de pase:");
                if (await checkPassword(pw)) {
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
        setTimeout(() => lockScreen.style.display = "none", 2500); // Dar tiempo a la animación CSS de 2s
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

    function burstHearts() {
        for (let i = 0; i < 60; i++) {
            const heart = document.createElement('span');
            heart.classList.add('floating-heart');
            // Easter egg: 5% de probabilidad de ser una tortuguita 🐢
            heart.innerText = Math.random() > 0.95 ? '🐢' : '💗';
            heart.style.left = `${Math.random() * 100}%`;
            heart.style.fontSize = `${Math.random() * 2 + 1.5}rem`;
            heart.style.animationDuration = `${Math.random() * 3 + 2}s`;
            heart.style.zIndex = '10001'; // Por encima de todo
            lockScreen.appendChild(heart);
        }
    }

    let surpriseTriggered = false;

    function update() {
        try {
            const now = new Date(); // Restaurar a fecha real
            const END_CELEBRATION = new Date(2026, 3, 13, 0, 0, 0);

            // Si ya pasamos la fecha de la sorpresa (13 de Abril en adelante), desbloquear la app permanentemente.
            if (!MODO_PRUEBA && now >= END_CELEBRATION) {
                devUnlocked = true;
                lockScreen.style.display = "none";
                document.body.style.overflow = "auto";
                return true; // Señal de expirado para detener el bucle
            }

            let bday;
            
            if (MODO_PRUEBA && testBdayDate) {
                bday = testBdayDate;
            } else {
                bday = new Date(2026, 3, 12, 0, 0, 0); // Objetivo Fijo: 12 de Abril 2026
            }

            const diff = bday - now;
            const isBirthday = (!MODO_PRUEBA && now.getMonth() === 3 && now.getDate() === 12) || (MODO_PRUEBA && diff <= 0);

            // Si es el momento mágico...
            if (isBirthday) {
                if (!surpriseTriggered) {
                    surpriseTriggered = true;

                    // Detectar si es la apertura inicial de media noche vs. una apertura durante el día
                    const isFirstMidnightMoment = !MODO_PRUEBA && now.getHours() === 0 && now.getMinutes() < 10;
                    
                    if (isFirstMidnightMoment || MODO_PRUEBA) {
                        // --- MODO MEDIA NOCHE: Celebración completa con instrucciones ---
                        massiveTimer.innerHTML = "¡Feliz Cumpleaños mi amor! 🎉<br><span style='font-size: 0.6em; color: white;'>Ve afuera de tu casa... 💐</span>";
                        massiveTimer.style.fontSize = window.innerWidth < 768 ? "1.8rem" : "3.5rem";
                        massiveTimer.style.color = "var(--accent-color)";

                        // Activar música romántica y explosión de corazones 🎉
                        const audio = document.getElementById("bg-audio");
                        if (audio) {
                            audio.addEventListener('ended', function () {
                                this.currentTime = 0;
                                this.play().catch(e => console.log('Loop interrumpido', e));
                            });
                            audio.play().catch(() => {
                                // El navegador bloqueó el autoplay: mostrar botón de respaldo
                                console.log("El navegador bloqueó el autoplay del audio. Mostrando botón manual.");
                                if (!document.getElementById('manual-music-btn')) {
                                    const playBtn = document.createElement('button');
                                    playBtn.id = 'manual-music-btn';
                                    playBtn.className = 'btn-primary';
                                    playBtn.style.marginTop = '20px';
                                    playBtn.innerHTML = '<i class="fa-solid fa-music"></i> Toca para escuchar nuestra canción';
                                    playBtn.onclick = () => audio.play().catch(() => {});
                                    lockScreen.appendChild(playBtn);
                                }
                            });
                        }
                        burstHearts();

                        if (!devUnlocked) {
                            setTimeout(unlockApp, 12000);
                            devUnlocked = true;
                        }
                    } else {
                        // --- MODO DIA DEL CUMPLEÑOS: Saludo suave y libre acceso inmediato ---
                        massiveTimer.innerHTML = "🎂 ¡Feliz Cumpleaños, mi amor! 💗";
                        massiveTimer.style.fontSize = window.innerWidth < 768 ? "1.8rem" : "2.5rem";
                        massiveTimer.style.color = "var(--accent-color)";
                        devUnlocked = true;
                        // Liberar rápido después de 2 segundos de saludo
                        setTimeout(unlockApp, 2000);
                    }
                }
                return;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            massiveTimer.innerText = `${d.toString().padStart(2, '0')}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
        } catch (e) {
            console.error("Error silencioso en update:", e);
        }
    }

    lockApp();
    const isExpired = update();
    
    if (isExpired) return; // Si ya pasó la fecha, no iniciar timers en absoluto para ahorrar batería

    // Actualizar 1 vez por segundo solo si está bloqueado, para ahorrar batería si está desbloqueado
    let intervalId = setInterval(() => {
        try {
            const currentNow = new Date();
            // Asegurar que getMonth existe, por si el navegador inyecta proxies raros
            if (!devUnlocked || (currentNow && typeof currentNow.getMonth === 'function' && currentNow.getMonth() === 3 && currentNow.getDate() === 12)) {
                if (update() === true) {
                    clearInterval(intervalId); // Destruir timer permanentemente el día 13
                }
            }
        } catch (e) {
            // Ignorar errores esporádicos del intervalo
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


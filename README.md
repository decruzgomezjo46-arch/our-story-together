# 💖 our-story-together

Aplicación web romántica tipo historia/memoria musical. JS vanilla, sin frameworks, sin build.

## 🚀 Cómo correr en local

**Opción 1 (recomendada):** extensión [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) de VS Code → clic derecho en `index.html` → "Open with Live Server".

**Opción 2:** Python:
```powershell
python -m http.server 8080
# abrir http://localhost:8080
```

> ⚠️ No abras `index.html` con doble clic (file://) para probar funciones de contraseña: usa siempre localhost.

### 🧪 Datos locales vs reales
- En **localhost / file://** la app usa la colección Firestore **`recuerdos_dev`** → tus pruebas NO tocan los recuerdos reales.
- En **producción** (dominio real o GitHub Pages) usa **`recuerdos`** automáticamente.
- 👀 **Ver los datos reales desde local**: abre `index.html?prod=1` → modo vista previa SOLO LECTURA (editar/borrar/guardar bloqueados).

## 🌐 Páginas de servicios que usa este proyecto

| Servicio | URL | Para qué | Datos clave |
|---|---|---|---|
| **Firebase Console** | https://console.firebase.google.com | Base de datos (Firestore) guarda los recuerdos | Proyecto: `amorapp-68726` |
| **Cloudinary Console** | https://console.cloudinary.com | Aloja las fotos y videos gratis | Cloud: `dwdxuhcmz` · Preset: `recuerdos_preset` |
| Google Fonts | https://fonts.google.com | Tipografías (Playfair Display, Montserrat) | — |
| Font Awesome | https://fontawesome.com | Íconos | vía CDN |
| Cloudinary Upload API | https://cloudinary.com/documentation/upload_images | Subida de multimedia sin backend | preset sin firmar |

### 🗜️ Compresión de archivos (histórico)
- **Antes**: se usaba **FFmpeg.wasm** dentro del navegador para comprimir videos antes de subirlos (requería el coi-serviceworker; por eso quedaron restos en `index.html`). La canción fue convertida con FFmpeg (`Lavf62.13.100`).
- **Ahora**: FFmpeg fue eliminado (commit `c990e7a`). **Cloudinary procesa todo automáticamente** vía transformaciones en la URL:
  - Videos → `q_auto,f_mp4,vc_h264,w_700,c_limit`
  - Imágenes → `q_auto,f_auto,w_800,c_limit`
- No se necesita ninguna página externa para reducir archivos. Opcional si quieres pre-comprimir manualmente: cloudconvert.com, freeconvert.com, 8mb.video.

> 🔑 Ambas cuentas se acceden probablemente con tu cuenta de Google.

## ✅ Qué te toca hacer a ti (checklist)

1. **Entrar a Firebase Console** (https://console.firebase.google.com) y confirmar que ves el proyecto `amorapp-68726`.
2. **Publicar reglas**: Firestore Database → pestaña *Reglas* → pegar contenido de `firestore.rules` → Publicar.
3. *(Opcional pero recomendado)* Activar **Authentication > Correo/contraseña**, crear usuario para ti y para ella, y cambiar a la Opción B del archivo `firestore.rules`.
4. **Cloudinary** (https://console.cloudinary.com): verificar que existe el upload preset **sin firmar** llamado `recuerdos_preset` (Settings → Upload → Upload presets).
5. Cuando todo esté listo para subir: definir hosting (GitHub Pages es gratis).

## 🔐 Cambiar la contraseña

El archivo `firestore.rules` no la guarda; vive hasheada en `app.js` (`PASSWORD_SHA256`, SHA-256).
Para cambiarla:
```powershell
$b=[Text.Encoding]::UTF8.GetBytes("NUEVACONTRASEÑA"); ($([Security.Cryptography.SHA256]::Create()).ComputeHash($b)|%{$_.ToString('x2')}) -join ''
```
Copia el resultado y reemplaza el valor de `PASSWORD_SHA256` en `app.js`.

## 📁 Estructura

- `index.html` — estructura de la página
- `styles.css` — estilos (tema vino/dorado + modo oscuro)
- `app.js` — toda la lógica (Firebase, Cloudinary, timeline, galería, sueños, cumpleaños)
- `nuestra_cancion.mp3.webm` — canción de fondo
- `firestore.rules` — reglas de seguridad de la base de datos
- `.github/workflows/opencode.yml` — bot opencode para comentarios `/oc` en GitHub

## ✨ Feature: Nuestros Sueños

Pestaña "Sueños ✨" con lista de metas juntos:

- Colección Firestore **`suenos`** (local: `suenos_dev`) — sincronizada en tiempo real
- Barra de progreso: "Cumplimos X de Y sueños"
- Botón corazón en cada tarjeta para marcar como cumplido → lluvia de corazones 💖
- Agregar es libre; **editar/eliminar piden la contraseña**
- ⚠️ Al publicar esta feature hay que **volver a publicar las reglas** (`firestore.rules` incluye las colecciones `suenos`/`suenos_dev`)

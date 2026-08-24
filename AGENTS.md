# our-story-together

Aplicación web interactiva tipo historia/memoria musical.

## Stack

- JavaScript vanilla
- HTML5 + CSS3
- Firebase Firestore (base de datos) + Cloudinary (multimedia)
- Audio (`nuestra_cancion.mp3.webm`)

## Files

- `index.html` — estructura de la página
- `styles.css` — estilos
- `app.js` — lógica de la aplicación
- `nuestra_cancion.mp3.webm` — archivo de audio
- `firestore.rules` — reglas de seguridad de Firestore
- `README.md` — instrucciones completas (setup local, servicios, checklist)

## Dev

Servir con Live Server o `python -m http.server`. NO abrir por file:// para probar contraseñas.

- En localhost se usa la colección `recuerdos_dev` (datos de prueba); en producción `recuerdos`.
- Contraseñas protegidas con SHA-256 en `app.js` (`PASSWORD_SHA256`).
- Todo texto dinámico debe pasar por `escapeHtml()` / `escapeAttr()` antes de inyectarse en HTML.

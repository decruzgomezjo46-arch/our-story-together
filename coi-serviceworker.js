/*! coi-serviceworker v0.1.7 | MIT License | https://github.com/gzuidhof/coi-serviceworker */
if (typeof window === 'undefined') {
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener('fetch', (event) => {
        if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
            return;
        }

        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
                    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => {
                    console.error("COI Service Worker fetch error:", e);
                    throw e; 
                })
        );
    });
} else {
    (() => {
        const script = document.currentScript;
        if (!script) return; // Fallback for modules

        const reloaded = sessionStorage.getItem('coiReloaded');
        if (window.crossOriginIsolated || reloaded) {
            sessionStorage.removeItem('coiReloaded');
            return;
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(script.src).then((registration) => {
                registration.addEventListener('updatefound', () => {
                    location.reload();
                });

                if (registration.active) {
                    sessionStorage.setItem('coiReloaded', 'true');
                    location.reload();
                }
            }, (err) => {
                console.error('COI Service Worker registration failed: ', err);
            });
        }
    })();
}

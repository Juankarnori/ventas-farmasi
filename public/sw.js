// Service Worker básico — solo lo mínimo para que la PWA sea instalable
// (un SW registrado es requisito) y para que los assets estáticos que
// casi nunca cambian (JS/CSS versionados de Next, íconos) carguen más
// rápido en visitas repetidas. A propósito NO cachea páginas, HTML ni
// nada que salga de Supabase — esta app es dinámica y depende de sesión;
// cachear eso serviría datos viejos o rotos. No hay soporte offline
// completo todavía, es un punto de partida.

const CACHE_NAME = "farmasi-bella-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

// Cache-first solo para los assets versionados de Next (/_next/static/...,
// nunca cambian de contenido bajo la misma URL) y los íconos de la PWA.
// Todo lo demás (páginas, API, llamadas a Supabase) pasa de largo directo
// a la red, sin tocar el cache — son dinámicos y dependen de sesión.
function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))
  );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== "GET" || !isStaticAsset(url)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }),
  );
});

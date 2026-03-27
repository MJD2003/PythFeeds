const CACHE_NAME = "pythfeeds-v4";
const IMG_CACHE = "pythfeeds-images-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== IMG_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Cache-first for fonts
  if (url.pathname.startsWith("/fonts/") || url.hostname.includes("fonts.g")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        }).catch(() => new Response("", { status: 204 }));
      })
    );
    return;
  }

  // Cache-first for CoinGecko images
  if (url.hostname.includes("coin-images.coingecko.com") || url.hostname.includes("assets.coingecko.com")) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => new Response("", { status: 204 }));
        })
      )
    );
    return;
  }

  // Skip external requests entirely -- let the browser handle them
  if (url.origin !== self.location.origin) return;

  // Never intercept _next build chunks or API calls -- let them go to network directly.
  // Caching _next chunks causes stale hash mismatches after deploys that break the app.
  if (url.pathname.startsWith("/_next") || url.pathname.startsWith("/api")) {
    return;
  }

  // Stale-while-revalidate for HTML pages
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() => {
        if (cached) return cached;
        if (request.headers.get("accept")?.includes("text/html")) {
          return new Response(
            "<html><body style='font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;color:#888'><div style='text-align:center'><h2>Offline</h2><p>You appear to be offline. Please check your connection.</p></div></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        }
        return new Response("", { status: 204 });
      });
      return cached || fetchPromise;
    })
  );
});

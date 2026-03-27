const CACHE_NAME = "pythfeeds-v3";
const IMG_CACHE = "pythfeeds-images-v1";
const STATIC_ASSETS = ["/", "/favicon.ico", "/manifest.json", "/fonts/inter-latin.woff2"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
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

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Cache-first for fonts (local + Google)
  if (url.pathname.startsWith("/fonts/") || url.hostname.includes("fonts.g")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        }).catch(() => new Response("", { status: 408 }));
      })
    );
    return;
  }

  // Cache-first for CoinGecko CDN images (coin logos)
  if (url.hostname.includes("coin-images.coingecko.com") || url.hostname.includes("assets.coingecko.com")) {
    event.respondWith(
      caches.open(IMG_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => new Response("", { status: 408 }));
        })
      )
    );
    return;
  }

  // Skip other external requests
  if (url.origin !== self.location.origin) return;

  // Network-first for API calls and Next.js chunks
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Stale-while-revalidate for coin detail pages
  if (url.pathname.startsWith("/coins/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Stale-while-revalidate for all other pages and static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return res;
      }).catch(() => {
        // Offline fallback: return cached or a simple offline message
        if (cached) return cached;
        if (request.headers.get("accept")?.includes("text/html")) {
          return new Response(
            "<html><body style='font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;color:#888'><div style='text-align:center'><h2>Offline</h2><p>You appear to be offline. Please check your connection.</p></div></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        }
        return new Response("", { status: 408 });
      });

      return cached || fetchPromise;
    })
  );
});

const CACHE_NAME = "honeycomb-v1.3";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./pwa.js",
  "./styles.css",
  "./milligram.min.css",
  "./wordlist.txt",
  "./manifest.webmanifest",
  "./README.md",
  "./favico.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png",

  // Roboto fonts
  "./roboto/Roboto-Light.ttf",
  "./roboto/Roboto-LightItalic.ttf",
  "./roboto/Roboto-Bold.ttf",
  "./roboto/Roboto-BoldItalic.ttf"
];

// Install: pre-cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static assets, network fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // IMPORTANT: do not cache dictionary API calls
  if (url.origin === "https://api.dictionaryapi.dev") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        // Cache successful GET responses for next time
        if (req.method === "GET" && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return resp;
      });
    })
  );
});

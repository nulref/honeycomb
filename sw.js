const CACHE_NAME = "honeycomb-v1.7";

const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./pwa.js",
  "./styles.css",
  "./milligram.min.css",
  "./wordlist.txt",
  "./manifest.webmanifest",
  "./favico.ico",
  "./icons/icon-192.png",
  "./icons/icon-512.png",

  "./roboto/Roboto-Light.ttf",
  "./roboto/Roboto-LightItalic.ttf",
  "./roboto/Roboto-Bold.ttf",
  "./roboto/Roboto-BoldItalic.ttf"
];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(ASSETS);
      self.skipWaiting();
    } catch (err) {
      console.error("Service worker install failed:", err);
      throw err;
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache dictionary lookups
  if (url.origin === "https://api.dictionaryapi.dev") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((resp) => {
        // Only runtime-cache same-origin GETs
        if (url.origin === self.location.origin && req.method === "GET" && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return resp;
      });
    })
  );
});

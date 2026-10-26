/* Bahay+ service worker.
 *
 * Caching policy (deliberately narrow):
 *   - Same-origin, GET only. Supabase and every other origin are never intercepted, so household,
 *     financial and file data (all fetched from Supabase or rendered per-user) is never cached here.
 *   - /_next/static/* (content-hashed, public build assets): cache-first.
 *   - App icons and the manifest: stale-while-revalidate.
 *   - Page navigations: always network. Only when the network fails is the static /offline page shown.
 *     Authenticated HTML is never stored.
 * Cache names carry the deploy version (?v=…); activating a new version deletes every older cache.
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC_CACHE = `bahayplus-static-${VERSION}`;
const SHELL_CACHE = `bahayplus-shell-${VERSION}`;
const OFFLINE_URL = "/offline";
const SHELL_ASSETS = [OFFLINE_URL, "/icons/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("bahayplus-") && k !== STATIC_CACHE && k !== SHELL_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.startsWith("/apple-icon") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
  // Everything else (RSC payloads, API routes, server actions): plain network, never cached.
});

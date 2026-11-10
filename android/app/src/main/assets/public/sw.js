const CACHE_NAME = "focusflow-cache-v6";

// Core static assets to precache
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/pwa-maskable-512x512.png",
  "/apple-touch-icon.png",
  "/icon.svg",
  "/icon.png",
  "/sounds/prayer.mp3",
  "/sounds/hygiene.mp3",
  "/sounds/study.mp3",
  "/sounds/workout.mp3",
  "/sounds/water.mp3",
  "/sounds/sleep.mp3",
  "/sounds/work.mp3",
  "/sounds/urgent.mp3"
];

// Install Event: Pre-cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use individual caching to prevent complete failure if any single resource fails
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`PWA: Pre-caching ${asset} skipped:`, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Service Worker: Clearing Old Cache", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache First Strategy with Network Fallback for static assets
self.addEventListener("fetch", (event) => {
  // Do NOT handle or cache any API routes
  if (event.request.url.includes("/api/")) {
    return;
  }

  // Only handle GET requests and skip browser extensions
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh in background to update cache for next time
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => { /* Ignore offline errors for background fetch */ });

        return cachedResponse;
      }

      // If not in cache, fetch from network and dynamically cache it
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for offline mode if HTML navigation is requested
        if (event.request.headers.get("accept")?.includes("text/html")) {
          return caches.match("/index.html") || caches.match("/");
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      });
    })
  );
});

// رویداد پوش آنلاین: دریافت نوتیفیکیشن از سرور زمانی که اینترنت برقرار است
self.addEventListener("push", (event) => {
  let data = {
    title: "FocusFlow",
    body: "یادآوری عادت یا تسک",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    data: { url: "/" }
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/pwa-192x192.png",
    badge: data.badge || "/pwa-192x192.png",
    vibrate: [250, 100, 250],
    tag: data.tag || "focusflow-reminder",
    renotify: true,
    data: data.data || { url: "/" }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// باز کردن برنامه با کلیک کاربر روی اعلان
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// پیام‌های داخلی کلاینت برای نوتیفیکیشن آفلاین و محلی
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_LOCAL_NOTIFICATION") {
    const { title, body, tag, data } = event.data;
    self.registration.showNotification(title || "FocusFlow", {
      body: body || "",
      icon: "/pwa-192x192.png",
      badge: "/pwa-192x192.png",
      vibrate: [250, 100, 250],
      tag: tag || "focusflow-local",
      renotify: true,
      requireInteraction: true,
      silent: false,
      data: data || { url: "/" }
    });
  }
});

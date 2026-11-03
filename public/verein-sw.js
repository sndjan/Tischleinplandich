// Service worker of the club app at /verein (scope /verein). It only handles push:
// shows the notification and, on tap, opens or focuses the app at the announced event.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Vereinsapp", {
      body: data.body || "",
      icon: "/verein/app-icon/192",
      badge: "/verein/app-icon/96",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/verein" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/verein", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const open = clients.find((client) => new URL(client.url).pathname.startsWith("/verein"));
      if (open) {
        await open.focus();
        return open.navigate(target).catch(() => open.postMessage({ type: "open", url: target }));
      }
      return self.clients.openWindow(target);
    }),
  );
});

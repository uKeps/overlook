// Overlook's service worker: only for Web Push (push.ts). A push shows its notification; a tap opens Overlook there.
self.addEventListener("push", (e) => {
  let m = { title: "Overlook" };
  try { m = e.data?.json() ?? m; } catch {}
  e.waitUntil(self.registration.showNotification(m.title, { body: m.body, tag: m.tag, renotify: !!m.tag, icon: "/icon.png", badge: "/icon.png", data: { url: m.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
    const w = ws[0];
    return w ? w.navigate(url).then((x) => (x || w).focus()).catch(() => w.focus()) : self.clients.openWindow(url);
  }));
});

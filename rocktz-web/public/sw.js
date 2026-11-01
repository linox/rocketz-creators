self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = typeof data.url === "string" && data.url ? data.url : "/";
  const key = typeof data.key === "string" ? data.key : "";

  event.waitUntil((async () => {
    const target = new URL(url, self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = windows.find((entry) => entry.url.startsWith(self.location.origin));
    if (client) {
      await client.focus();
      client.postMessage({ type: "rocketz-browser-alert", url, key });
      return;
    }
    await self.clients.openWindow(target);
  })());
});

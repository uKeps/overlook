// Overlook's page in the desktop app: it knows it runs there (browser cards become real browsers) and hears links that
// a card's page wants in a new tab; it can bring your Zen/Firefox logins into the card browser.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("overlookDesktop", {
  onOpen: (fn) => ipcRenderer.on("br-open", (_e, from, url, disp) => fn(from, url, disp)),
  importLogins: (from) => ipcRenderer.invoke("import-logins", from),
  privateClear: () => ipcRenderer.invoke("private-clear"),
  wvTarget: (id) => ipcRenderer.invoke("wv-target", id),
  capture: (id, rect) => ipcRenderer.invoke("br-capture", id, rect),
  shields: (on) => ipcRenderer.invoke("shields", on),
});

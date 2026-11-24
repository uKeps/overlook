// Overlook's page in the desktop app: it knows it runs there (browser cards become real browsers) and hears links that
// a card's page wants in a new tab.
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("overlookDesktop", {
  onOpen: (fn) => ipcRenderer.on("br-open", (_e, from, url) => fn(from, url)),
});

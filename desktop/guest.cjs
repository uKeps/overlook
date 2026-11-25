// In every browser card's page (isolated from it): the keys and mouse buttons a browser handles itself. Back/forward and
// reload act here; Ctrl+L and zoom go to the card (its address bar, its zoom).
const { ipcRenderer } = require("electron");
addEventListener("mouseup", (e) => {
  if (e.button === 3) history.back();
  else if (e.button === 4) history.forward();
  else return;
  e.preventDefault();
}, true);
// Ctrl + wheel (and a touchpad pinch, which comes as one) zooms the canvas, not this page: over a card the canvas zoom
// used to stop (Electron doesn't zoom a page on it either), so a quick pinch stalled when a browser card slid under it.
addEventListener("wheel", (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  ipcRenderer.sendToHost("wheel", { dx: e.deltaX, dy: e.deltaY, mode: e.deltaMode, x: e.clientX, y: e.clientY, w: innerWidth });
}, { capture: true, passive: false });
addEventListener("keydown", (e) => {
  const c = (e.ctrlKey || e.metaKey) && !e.altKey, alt = e.altKey && !e.ctrlKey && !e.metaKey;
  const act = alt && e.key === "ArrowLeft" ? () => history.back()
    : alt && e.key === "ArrowRight" ? () => history.forward()
    : e.key === "F5" || (c && e.code === "KeyR") ? () => location.reload()
    : c && e.code === "KeyL" ? () => ipcRenderer.sendToHost("url")
    : c && ["Equal", "NumpadAdd"].includes(e.code) ? () => ipcRenderer.sendToHost("zoom", 1)
    : c && ["Minus", "NumpadSubtract"].includes(e.code) ? () => ipcRenderer.sendToHost("zoom", -1)
    : c && ["Digit0", "Numpad0"].includes(e.code) ? () => ipcRenderer.sendToHost("zoom", 0)
    // tabs, as in Brave: new, close, next/previous, the nth (9: the last)
    : c && !e.shiftKey && e.code === "KeyT" ? () => ipcRenderer.sendToHost("tab", "new")
    : c && !e.shiftKey && e.code === "KeyW" ? () => ipcRenderer.sendToHost("tab", "close")
    : c && ((e.key === "Tab" && !e.shiftKey) || e.key === "PageDown") ? () => ipcRenderer.sendToHost("tab", "next")
    : c && ((e.key === "Tab" && e.shiftKey) || e.key === "PageUp") ? () => ipcRenderer.sendToHost("tab", "prev")
    : c && !e.shiftKey && /^Digit[1-9]$/.test(e.code) ? () => ipcRenderer.sendToHost("tab", +e.code.slice(5)) : null;
  if (!act) return;
  e.preventDefault(); e.stopPropagation();
  act();
}, true);

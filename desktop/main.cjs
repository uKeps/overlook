// Overlook's desktop app: the same page as the web (served by `bun server.ts`) in a window of its own, where a browser
// card is a real browser (Electron's <webview>, see mountWebview in app.js): sound, video, popups, downloads, uploads,
// text selection, a right-click menu. The web page keeps the streamed browser card. Start it with desktop/run.
const { app, BrowserWindow, Menu, clipboard, dialog, shell } = require("electron");
const path = require("node:path");

const BASE = process.env.OVERLOOK_APP_URL || `http://127.0.0.1:${process.env.PORT || 3333}/`;
const GUEST = path.join(__dirname, "guest.cjs");
const web = (u) => /^(https?:\/\/|about:blank$)/i.test(u || "");
let win = null;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
app.on("window-all-closed", () => app.quit());

// The right-click menu a browser has: navigation, editing, links, images, Inspect.
function contextMenu(wc, p, page) {
  const items = [];
  if (page) items.push(
    { label: "Back", enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
    { label: "Forward", enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
    { label: "Reload", click: () => wc.reload() }, { type: "separator" });
  if (p.linkURL) items.push(
    ...(page && web(p.linkURL) ? [{ label: "Open link in a new card", click: () => openCard(wc, p.linkURL) }] : []),
    { label: "Copy link address", click: () => clipboard.writeText(p.linkURL) }, { type: "separator" });
  if (p.mediaType === "image" && p.srcURL) items.push({ label: "Copy image", click: () => wc.copyImageAt(p.x, p.y) }, { label: "Copy image address", click: () => clipboard.writeText(p.srcURL) }, { type: "separator" });
  if (p.isEditable) items.push({ role: "undo", enabled: p.editFlags.canUndo }, { role: "redo", enabled: p.editFlags.canRedo }, { type: "separator" }, { role: "cut", enabled: p.editFlags.canCut });
  if (p.isEditable || p.selectionText) items.push({ role: "copy", enabled: p.editFlags.canCopy });
  if (p.isEditable) items.push({ role: "paste", enabled: p.editFlags.canPaste }, { role: "selectAll" });
  if (page) items.push({ type: "separator" }, { label: "Inspect", click: () => wc.inspectElement(p.x, p.y) });
  const menu = items.filter((it, i, a) => !(it.type === "separator" && (i === 0 || a[i - 1].type === "separator" || i === a.length - 1)));
  if (menu.length) Menu.buildFromTemplate(menu).popup();
}
// A link meant for a new tab (target=_blank, middle click, the menu): a card beside the one it came from.
const openCard = (guest, url) => guest.hostWebContents?.send("br-open", guest.id, url);

// What a page may use. Overlook itself gets what it asks for; a site asks you, like a browser does.
const SAFE = new Set(["fullscreen", "clipboard-sanitized-write", "pointerLock", "keyboardLock", "window-management"]);
function askPermission(wc, perm, done, details) {
  if (SAFE.has(perm)) return done(true);
  const origin = (() => { try { return new URL(details.requestingUrl || wc.getURL()).host; } catch { return "This page"; } })();
  const what = perm === "media" ? (details.mediaTypes || []).join(" and ") || "camera or microphone" : perm;
  dialog.showMessageBox(win, { type: "question", message: `${origin} wants to use: ${what}`, buttons: ["Allow", "Block"], defaultId: 1, cancelId: 1 })
    .then((r) => done(r.response === 0)).catch(() => done(false));
}

app.on("web-contents-created", (_e, wc) => {
  // A browser card's page: a sandboxed guest in its own persistent session, with the guest preload (back/forward keys
  // and mouse buttons) and nothing else.
  wc.on("will-attach-webview", (e, prefs, params) => {
    if (!web(params.src || "about:blank")) return e.preventDefault();
    delete prefs.preloadURL;
    Object.assign(prefs, { preload: GUEST, nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false });
    params.partition = "persist:browser";
  });
  if (wc.getType() === "webview") {
    wc.setWindowOpenHandler(({ url, disposition }) => {
      // a popup (a sign-in window: it talks back to the page that opened it) opens as a window, as in a browser
      if (disposition === "new-window") return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 520, height: 720 } };
      if (web(url)) openCard(wc, url);
      return { action: "deny" };
    });
    wc.on("context-menu", (_e, p) => contextMenu(wc, p, true));
  } else if (wc.getType() === "window" && wc !== win?.webContents) {
    wc.on("context-menu", (_e, p) => contextMenu(wc, p, true)); // a popup window
  }
});

app.whenReady().then(() => {
  const { session } = require("electron");
  session.fromPartition("persist:browser").setPermissionRequestHandler(askPermission);
  win = new BrowserWindow({
    width: 1440, height: 920, title: "Overlook", autoHideMenuBar: true, backgroundColor: "#141414",
    icon: path.join(__dirname, "..", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), webviewTag: true, contextIsolation: true, sandbox: true },
  });
  const wc = win.webContents;
  // Overlook's own links to elsewhere (a PR, a site, obsidian://) open outside, in the system's apps.
  wc.setWindowOpenHandler(({ url }) => { if (!url.startsWith(BASE)) shell.openExternal(url); return { action: "deny" }; });
  wc.on("will-navigate", (e, url) => { if (!url.startsWith(BASE)) { e.preventDefault(); shell.openExternal(url); } });
  wc.on("context-menu", (_e, p) => contextMenu(wc, p, false)); // copy and paste in Overlook's fields
  // Overlook not up yet (the app started before the service): try again until it is.
  wc.on("did-fail-load", (_e, code, _d, url, main) => { if (main && code !== -3) setTimeout(() => win?.loadURL(BASE), 2000); });
  win.on("closed", () => { win = null; });
  win.loadURL(BASE);
});

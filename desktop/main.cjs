// Overlook's desktop app: the same page as the web (served by `bun server.ts`) in a window of its own, where a browser
// card is a real browser (Electron's <webview>, see mountWebview in app.js): sound, video, popups, downloads, uploads,
// text selection, a right-click menu. The web page keeps the streamed browser card. Start it with desktop/run.
const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, session, shell, webContents } = require("electron");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");

const BASE = process.env.OVERLOOK_APP_URL || `http://127.0.0.1:${process.env.PORT || 3333}/`;
const GUEST = path.join(__dirname, "guest.cjs");
const web = (u) => /^(https?:\/\/|about:blank$)/i.test(u || "");
let win = null;

// The app's DevTools endpoint, on this machine only (port in userData/DevToolsActivePort): Overlook's server drives a
// card's webview through it, so agents (overlook browser …) and a phone act on the page you see.
if (!app.commandLine.hasSwitch("remote-debugging-port")) app.commandLine.appendSwitch("remote-debugging-port", "0");
app.commandLine.appendSwitch("remote-debugging-address", "127.0.0.1");

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

// "Import logins from Zen": the cookies of your Firefox-family browser copied into the card browser's session, so its
// sites know you. The database is copied first (the browser keeps it open); containers and partitioned cookies stay
// behind, and so do saved passwords (encrypted with that browser's key).
const FIREFOXES = [["Zen", ".config/zen"], ["Zen", ".zen"], ["Firefox", ".mozilla/firefox"], ["LibreWolf", ".librewolf"]];
function firefoxProfile() {
  for (const [name, dir] of FIREFOXES) {
    const root = path.join(os.homedir(), dir), read = (f) => { try { return fs.readFileSync(path.join(root, f), "utf8"); } catch { return ""; } };
    // the profile this install opens (installs.ini), else the one marked Default=1 in profiles.ini
    const rel = /^Default=(.+)$/m.exec(read("installs.ini"))?.[1] || read("profiles.ini").split(/^\[/m).map((sec) => /^Default=1$/m.test(sec) && /^Path=(.+)$/m.exec(sec)?.[1]).find(Boolean);
    const dir2 = rel && (path.isAbsolute(rel) ? rel : path.join(root, rel));
    if (dir2 && fs.existsSync(path.join(dir2, "cookies.sqlite"))) return { name, dir: dir2 };
  }
  return null;
}
const SAME_SITE = { 0: "no_restriction", 1: "lax", 2: "strict" }; // Firefox's 256: no attribute set
async function importLogins() {
  const prof = firefoxProfile();
  if (!prof) return { error: "No Zen or Firefox profile found" };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "overlook-cookies-")); // 0700
  try {
    for (const f of ["cookies.sqlite", "cookies.sqlite-wal"]) { try { fs.copyFileSync(path.join(prof.dir, f), path.join(tmp, f)); } catch {} }
    const { DatabaseSync } = require("node:sqlite"), db = new DatabaseSync(path.join(tmp, "cookies.sqlite"));
    const rows = db.prepare("SELECT name, value, host, path, expiry, isSecure, isHttpOnly, sameSite FROM moz_cookies WHERE originAttributes = ''").all();
    db.close();
    const ses = session.fromPartition("persist:browser"), now = Date.now();
    let count = 0;
    for (const c of rows) {
      const exp = c.expiry > 1e11 ? c.expiry / 1000 : c.expiry; // milliseconds in recent Firefox, seconds before
      if (!c.host || exp * 1000 < now) continue;
      const secure = !!c.isSecure, sameSite = SAME_SITE[c.sameSite] === "no_restriction" && !secure ? "unspecified" : SAME_SITE[c.sameSite] || "unspecified";
      count += await ses.cookies.set({
        url: `${secure ? "https" : "http"}://${c.host.replace(/^\./, "")}${c.path || "/"}`, name: c.name, value: c.value, path: c.path || "/",
        secure, httpOnly: !!c.isHttpOnly, expirationDate: exp, sameSite, ...(c.host.startsWith(".") && { domain: c.host }),
      }).then(() => 1, () => 0);
    }
    await ses.cookies.flushStore();
    return { browser: prof.name, count };
  } catch (e) { return { error: String(e?.message || e) }; }
  finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
// A card's webview → its DevTools target, for the server to attach to (only Overlook's own window asks, for its own guests).
ipcMain.handle("wv-target", async (e, id) => {
  const wc = e.sender === win?.webContents && webContents.fromId(Number(id));
  if (!wc || wc.hostWebContents !== win.webContents) return null;
  let port = "";
  try { port = fs.readFileSync(path.join(app.getPath("userData"), "DevToolsActivePort"), "utf8").split("\n")[0].trim(); } catch {}
  if (!/^\d+$/.test(port)) return null;
  try { wc.debugger.attach("1.3"); } catch {}
  try { return { port, target: (await wc.debugger.sendCommand("Target.getTargetInfo")).targetInfo.targetId }; }
  catch { return null; }
  finally { try { wc.debugger.detach(); } catch {} }
});
ipcMain.handle("import-logins", (e) => (e.sender === win?.webContents ? importLogins() : { error: "not allowed" }));

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
  const ses = session.fromPartition("persist:browser");
  ses.setPermissionRequestHandler(askPermission);
  // a plain Chrome user agent: with "Electron/…" in it Google refuses to sign in ("this browser may not be secure")
  ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|overlook)\/\S+/gi, ""));
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

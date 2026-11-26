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
    ...(page && web(p.linkURL) ? [{ label: "Open link in new tab", click: () => openCard(wc, p.linkURL, "background-tab") }, { label: "Open link in private tab", click: () => openCard(wc, p.linkURL, "private") }] : []),
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
const openCard = (guest, url, disp = "foreground-tab") => guest.hostWebContents?.send("br-open", guest.id, url, disp);

// What a page may use. Overlook itself gets what it asks for; a site asks you, like a browser does.
// What a page may use: what a browser asks you about (camera, microphone, location, notifications, reading the
// clipboard, devices, opening another app) is asked once per site and remembered; the rest (storage access for a
// sign-in, full screen, pointer lock...) is granted, as a browser does, without a prompt.
const ASK = new Set(["media", "geolocation", "notifications", "clipboard-read", "midi", "midiSysex", "hid", "serial", "usb", "display-capture", "idle-detection", "openExternal"]);
const PERMS = () => path.join(app.getPath("userData"), "permissions.json");
let perms = null; // "origin perm" -> true/false
function askPermission(wc, perm, done, details) {
  if (!ASK.has(perm)) return done(true);
  const origin = (() => { try { return new URL(details.requestingUrl || wc.getURL()).origin; } catch { return ""; } })();
  const what = perm === "media" ? (details.mediaTypes || []).join(" and ") || "camera or microphone" : perm === "openExternal" ? `open ${details.externalURL || "another app"}` : perm;
  perms ??= (() => { try { return JSON.parse(require("node:fs").readFileSync(PERMS(), "utf8")); } catch { return {}; } })();
  const key = `${origin} ${perm === "media" ? `media:${(details.mediaTypes || []).sort().join(",")}` : perm}`;
  if (origin && key in perms) return done(perms[key]);
  dialog.showMessageBox(win, { type: "question", message: `${origin.replace(/^https?:\/\//, "") || "This page"} wants to use: ${what}`, buttons: ["Allow", "Block"], defaultId: 1, cancelId: 1, checkboxLabel: "Remember for this site", checkboxChecked: true })
    .then((r) => {
      const ok = r.response === 0;
      if (origin && r.checkboxChecked) { perms[key] = ok; try { require("node:fs").writeFileSync(PERMS(), JSON.stringify(perms, null, 1)); } catch {} }
      done(ok);
    }).catch(() => done(false));
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
// "Import logins from Brave": the cookies of your Brave (its default profile) and of the browser the cards used before
// the desktop app (the server's, in cache/browser-profile: where you signed in to sites from a card), decrypted and set in
// the card browser's session. Chromium on Linux encrypts them with AES-128-CBC: "v11" with a key from the keyring
// ("Brave Safe Storage", read with secret-tool), "v10" with a fixed one; since database version 24 the plain text starts
// with a SHA-256 of the cookie's host. A cookie that doesn't decrypt is left out.
const BRAVES = [path.join(os.homedir(), ".config/BraveSoftware/Brave-Browser/Default/Cookies"), path.join(__dirname, "..", "cache/browser-profile/Default/Cookies")];
const CHROME_SAME_SITE = { 0: "no_restriction", 1: "lax", 2: "strict" }; // -1: unspecified
function braveKeys() {
  const crypto = require("node:crypto"), key = (pw) => crypto.pbkdf2Sync(pw, "saltysalt", 1, 16, "sha1");
  let pw = "";
  try { pw = require("node:child_process").execFileSync("secret-tool", ["lookup", "application", "brave"], { encoding: "utf8", timeout: 10_000 }).trim(); } catch {}
  return { v10: key("peanuts"), ...(pw && { v11: key(pw) }) };
}
async function importBrave() {
  const files = BRAVES.filter((f) => fs.existsSync(f));
  if (!files.length) return { error: "No Brave profile found" };
  const crypto = require("node:crypto"), { DatabaseSync } = require("node:sqlite"), keys = braveKeys(), ses = session.fromPartition("persist:browser"), now = Date.now();
  let count = 0, err = "";
  for (const file of files) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "overlook-cookies-")); // 0700
    try {
      fs.copyFileSync(file, path.join(tmp, "c")); // the browser keeps it open
      const db = new DatabaseSync(path.join(tmp, "c"));
      const ver = Number(db.prepare("SELECT value FROM meta WHERE key = ?").get("version")?.value) || 0;
      const rows = db.prepare("SELECT host_key, name, value, encrypted_value, path, expires_utc / 1000000 AS expires_s, is_secure, is_httponly, samesite, has_expires FROM cookies").all();
      db.close();
      for (const c of rows) {
        let value = c.value;
        const enc = Buffer.from(c.encrypted_value || []), key = keys[enc.subarray(0, 3).toString()];
        if (enc.length) {
          if (!key) continue;
          try {
            const d = crypto.createDecipheriv("aes-128-cbc", key, Buffer.alloc(16, " ")), out = Buffer.concat([d.update(enc.subarray(3)), d.final()]);
            const hashed = ver >= 24 && out.subarray(0, 32).equals(crypto.createHash("sha256").update(c.host_key).digest());
            if (ver >= 24 && !hashed) continue; // the wrong key: garbage, not a cookie
            value = out.subarray(hashed ? 32 : 0).toString("utf8");
          } catch { continue; }
        }
        const exp = c.has_expires ? c.expires_s - 11644473600 : 0; // seconds since 1601 (microseconds, too big to read as a number) -> since 1970
        if (!c.host_key || (exp && exp * 1000 < now)) continue;
        const secure = !!c.is_secure, sameSite = CHROME_SAME_SITE[c.samesite] === "no_restriction" && !secure ? "unspecified" : CHROME_SAME_SITE[c.samesite] || "unspecified";
        count += await ses.cookies.set({
          url: `${secure ? "https" : "http"}://${c.host_key.replace(/^\./, "")}${c.path || "/"}`, name: c.name, value, path: c.path || "/",
          secure, httpOnly: !!c.is_httponly, sameSite, ...(exp && { expirationDate: exp }), ...(c.host_key.startsWith(".") && { domain: c.host_key }),
        }).then(() => 1, (e) => { err ||= String(e?.message || e); return 0; });
      }
    } catch (e) { err ||= String(e?.message || e); }
    finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  await ses.cookies.flushStore();
  return !count && err ? { error: err } : { browser: "Brave", count };
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
// Ads and trackers blocked in every browser card, as Brave's Shields do: Ghostery's engine with its prebuilt ads +
// tracking lists (EasyList, uBlock's filters...), on requests and on the page (cosmetic filters, a preload). The lists
// are fetched once and cached in userData, refreshed when a day old. The card's menu turns it off and on (shields.json).
let blocker = null;
const SHIELDS = () => path.join(app.getPath("userData"), "shields.json");
const shieldsOn = () => { try { return JSON.parse(fs.readFileSync(SHIELDS(), "utf8")).on !== false; } catch { return true; } };
// The card browser's sessions: its own (kept on disk) and the private tabs' (in memory only, wiped when the last one closes).
const SESSIONS = ["persist:browser", "incognito"];
async function shields(on) {
  if (!on) return void SESSIONS.map((s) => session.fromPartition(s)).forEach((ses) => blocker?.isBlockingEnabled(ses) && blocker.disableBlockingInSession(ses));
  if (!blocker) {
    const { ElectronBlocker } = require("@ghostery/adblocker-electron"), cache = path.join(app.getPath("userData"), "adblock.bin");
    try { if (Date.now() - fs.statSync(cache).mtimeMs > 86_400_000) fs.rmSync(cache); } catch {}
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, { path: cache, read: fs.promises.readFile, write: fs.promises.writeFile });
  }
  for (const ses of SESSIONS.map((s) => session.fromPartition(s))) if (!blocker.isBlockingEnabled(ses)) blocker.enableBlockingInSession(ses);
}
// The last private tab closed: what it left (cookies, storage, cache) goes, as when a private window closes.
ipcMain.handle("private-clear", async (e) => {
  if (e.sender !== win?.webContents) return;
  const ses = session.fromPartition("incognito");
  await Promise.all([ses.clearStorageData(), ses.clearCache(), ses.clearAuthCache()]).catch(() => {});
});
ipcMain.handle("shields", async (e, on) => {
  if (e.sender !== win?.webContents) return null;
  if (typeof on === "boolean") { fs.writeFileSync(SHIELDS(), JSON.stringify({ on })); await shields(on).catch((err) => console.error("ad blocking:", err.message)); }
  return shieldsOn();
});
ipcMain.handle("import-logins", (e, from) => (e.sender !== win?.webContents ? { error: "not allowed" } : from === "brave" ? importBrave() : importLogins()));
// A photo of a browser card's page, for the canvas to show in its place while it zooms (freezeWebviews in app.js), taken
// from the page itself (the window's photo had whatever lay over the card in it, the dock or the map, and it zoomed with
// the card). Encoded here: the page's own toDataURL is a PNG made on the canvas's thread (~25 ms a card). A page with no
// background of its own is transparent, and as a JPEG that came out black (why #139 took the window's): it goes as a PNG.
ipcMain.handle("br-capture", async (e, id) => {
  const wc = e.sender === win?.webContents && webContents.fromId(Number(id));
  if (!wc || wc.hostWebContents !== win.webContents) return null;
  const img = await wc.capturePage(), px = img.toBitmap();
  for (let i = 3; i < px.length; i += 4 * 997) if (px[i] < 255) return img.toPNG();
  return img.toJPEG(85);
});

app.on("web-contents-created", (_e, wc) => {
  // A browser card's page: a sandboxed guest in its own persistent session, with the guest preload (back/forward keys
  // and mouse buttons) and nothing else.
  wc.on("will-attach-webview", (e, prefs, params) => {
    if (!web(params.src || "about:blank")) return e.preventDefault();
    delete prefs.preloadURL;
    Object.assign(prefs, { preload: GUEST, nodeIntegration: false, contextIsolation: true, sandbox: true, webviewTag: false });
    params.partition = params.partition === "incognito" ? "incognito" : "persist:browser"; // a private tab's, or the card browser's
  });
  if (wc.getType() === "webview") {
    wc.setWindowOpenHandler(({ url, disposition }) => {
      // a popup (a sign-in window: it talks back to the page that opened it) opens as a window, as in a browser
      if (disposition === "new-window") return { action: "allow", overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 520, height: 720 } };
      if (web(url)) openCard(wc, url, disposition);
      return { action: "deny" };
    });
    wc.on("context-menu", (_e, p) => contextMenu(wc, p, true));
  } else if (wc.getType() === "window" && wc !== win?.webContents) {
    wc.on("context-menu", (_e, p) => contextMenu(wc, p, true)); // a popup window
  }
});

app.whenReady().then(() => {
  // No application menu: Electron's default one bound Ctrl+W to closing Overlook and Ctrl+R to reloading it, keys a
  // browser card's page (its tabs, its reload) needs. Copy, paste and the rest still work without it.
  Menu.setApplicationMenu(null);
  for (const ses of SESSIONS.map((s) => session.fromPartition(s))) {
    ses.setPermissionRequestHandler(askPermission);
    // a plain Chrome user agent: with "Electron/…" in it Google refuses to sign in ("this browser may not be secure")
    ses.setUserAgent(ses.getUserAgent().replace(/\s(Electron|overlook)\/\S+/gi, ""));
    // Google still spots an embedded Chromium (the user agent alone is not enough) and refuses to sign in: its sign-in
    // pages get a Firefox user agent and no Chromium client hints, which it accepts (Min browser does the same).
    ses.webRequest.onBeforeSendHeaders({ urls: ["https://accounts.google.com/*"] }, ({ requestHeaders: h }, done) => {
      for (const k of Object.keys(h)) if (/^sec-ch-ua/i.test(k)) delete h[k];
      done({ requestHeaders: { ...h, "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0" } });
    });
  }
  if (shieldsOn()) shields(true).catch((e) => console.error("ad blocking:", e.message));
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

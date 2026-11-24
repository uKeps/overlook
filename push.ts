// Web Push, no dependency: notifications that ring on a phone with Overlook closed (an iPhone: once it's on the Home
// Screen). The browser gives a subscription (its push service's address and keys); the server signs each send with its
// own VAPID key (RFC 8292) and encrypts the message for that browser only (RFC 8291, aes128gcm), with WebCrypto.
// Keys and subscriptions live in cache/ (not in git).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const b64u = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");
const unb64u = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const utf8 = (s: string) => new TextEncoder().encode(s);
const hkdf = async (salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) =>
  new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), bytes * 8));
// A P-256 key from its raw public point (65 bytes: 04 || x || y) and, for a private one, d.
const jwk = (pub: Uint8Array, d?: string) => ({ kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ...(d ? { d } : {}), ext: true });

export type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

// The message encrypted for one browser (RFC 8291). `as` and `salt` are only given by the test (the RFC's example).
export async function encrypt(sub: Sub, text: string, as?: { pub: string; priv: string }, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const pair = as
    ? { pub: unb64u(as.pub), key: await crypto.subtle.importKey("jwk", jwk(unb64u(as.pub), as.priv), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]) }
    : await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]).then(async (k) => ({ pub: new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey)), key: k.privateKey }));
  const uaKey = await crypto.subtle.importKey("raw", ua, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, pair.key, 256));
  const ikm = await hkdf(auth, shared, cat(utf8("WebPush: info\0"), ua, pair.pub), 32);
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16), nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]), cat(utf8(text), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65;
  return cat(head, pair.pub, body);
}

// This server's VAPID key pair, made on first use.
type Vapid = { pub: string; priv: string };
let vapid: Vapid | null = null;
async function vapidKeys(file: string): Promise<Vapid> {
  if (vapid) return vapid;
  if (existsSync(file)) return (vapid = JSON.parse(readFileSync(file, "utf8")));
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  vapid = { pub: b64u(await crypto.subtle.exportKey("raw", k.publicKey)), priv: (await crypto.subtle.exportKey("jwk", k.privateKey)).d! };
  mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(vapid), { mode: 0o600 });
  return vapid;
}
// PUSH_CONTACT: who the push services may write to about this sender (Apple wants one); a placeholder otherwise.
export async function vapidHeader(v: Vapid, endpoint: string) {
  const enc = (o: object) => b64u(utf8(JSON.stringify(o)));
  const unsigned = `${enc({ typ: "JWT", alg: "ES256" })}.${enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.PUSH_CONTACT || "mailto:overlook@example.com" })}`;
  const key = await crypto.subtle.importKey("jwk", jwk(unb64u(v.pub), v.priv), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(unsigned)); // raw r || s, what ES256 wants
  return `vapid t=${unsigned}.${b64u(sig)}, k=${v.pub}`;
}

// Only the browsers' own push services: a subscription is the one address this server posts to on its own.
const PUSH_HOSTS = /(^|\.)(push\.apple\.com|fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/;
export const validSub = (s: any): s is Sub => {
  try {
    const u = new URL(s?.endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.test(u.hostname) && typeof s.keys?.p256dh === "string" && unb64u(s.keys.p256dh).length === 65 && typeof s.keys?.auth === "string" && unb64u(s.keys.auth).length === 16;
  } catch { return false; }
};

export function pushStore(dir: string) {
  const KEYS = `${dir}/push-vapid.json`, SUBS = `${dir}/push-subs.json`;
  let subs: Sub[] = existsSync(SUBS) ? JSON.parse(readFileSync(SUBS, "utf8")) : [];
  const save = () => { mkdirSync(dir, { recursive: true }); writeFileSync(SUBS, JSON.stringify(subs), { mode: 0o600 }); };
  return {
    key: async () => (await vapidKeys(KEYS)).pub,
    count: () => subs.length,
    add(s: Sub) { subs = [...subs.filter((x) => x.endpoint !== s.endpoint), { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }].slice(-10); save(); },
    remove(endpoint: string) { subs = subs.filter((x) => x.endpoint !== endpoint); save(); },
    // To every subscribed browser; one the push service says is gone (404/410) is dropped.
    async send(msg: { title: string; body?: string; tag?: string; url?: string }) {
      if (!subs.length) return 0;
      const v = await vapidKeys(KEYS), text = JSON.stringify(msg);
      let sent = 0;
      for (const s of [...subs]) {
        try {
          const r = await fetch(s.endpoint, { method: "POST", signal: AbortSignal.timeout(10_000), body: await encrypt(s, text),
            headers: { authorization: await vapidHeader(v, s.endpoint), ttl: "86400", urgency: "high", "content-encoding": "aes128gcm", "content-type": "application/octet-stream" } });
          if (r.status === 404 || r.status === 410) this.remove(s.endpoint); else if (r.ok) sent++;
        } catch {}
      }
      return sent;
    },
  };
}

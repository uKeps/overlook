import { test, expect } from "bun:test";
import { encrypt, validSub } from "../push";

// RFC 8291 section 5: the example message, keys and salt, and the body it must encrypt to.
const RFC = {
  text: "When I grow up, I want to be a watermelon",
  // the RFC's published example keys, not secrets
  as: { pub: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8", priv: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw" }, // gitleaks:allow
  ua: { pub: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", priv: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94" }, // gitleaks:allow
  auth: "BTBZMqHH6r4Tts7J_aSIgg", salt: "DGv6ra1nlYgDCS1FRnbzlw", // gitleaks:allow
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};
const sub = { endpoint: "https://web.push.apple.com/x", keys: { p256dh: RFC.ua.pub, auth: RFC.auth } };

test("a push message is encrypted as RFC 8291's example says", async () => {
  const out = await encrypt(sub, RFC.text, RFC.as, new Uint8Array(Buffer.from(RFC.salt, "base64url")));
  expect(Buffer.from(out).toString("base64url")).toBe(RFC.body);
});

test("the browser holding the subscription's key reads a push message back", async () => {
  const out = await encrypt(sub, "ping é 🚀"); // a fresh key and salt
  const u = (s: string) => new Uint8Array(Buffer.from(s, "base64url")), te = (s: string) => new TextEncoder().encode(s);
  const salt = out.slice(0, 16), asPub = out.slice(21, 86), ct = out.slice(86);
  const jwk = (p: Uint8Array, d?: string) => ({ kty: "EC", crv: "P-256", x: Buffer.from(p.slice(1, 33)).toString("base64url"), y: Buffer.from(p.slice(33)).toString("base64url"), ...(d ? { d } : {}) });
  const mine = await crypto.subtle.importKey("jwk", jwk(u(RFC.ua.pub), RFC.ua.priv), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const theirs = await crypto.subtle.importKey("jwk", jwk(asPub), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: theirs }, mine, 256));
  const hk = async (s: Uint8Array, k: Uint8Array, info: Uint8Array, n: number) => new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: s, info }, await crypto.subtle.importKey("raw", k, "HKDF", false, ["deriveBits"]), n * 8));
  const ikm = await hk(u(RFC.auth), shared, new Uint8Array([...te("WebPush: info\0"), ...u(RFC.ua.pub), ...asPub]), 32);
  const key = await hk(salt, ikm, te("Content-Encoding: aes128gcm\0"), 16), iv = await hk(salt, ikm, te("Content-Encoding: nonce\0"), 12);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]), ct));
  expect(new TextDecoder().decode(plain.slice(0, -1))).toBe("ping é 🚀");
  expect(plain.at(-1)).toBe(2); // the last record's delimiter
});

test("only a real push service's address is taken as a subscription", () => {
  expect(validSub(sub)).toBe(true);
  expect(validSub({ ...sub, endpoint: "https://fcm.googleapis.com/fcm/send/abc" })).toBe(true);
  expect(validSub({ ...sub, endpoint: "http://web.push.apple.com/x" })).toBe(false);
  expect(validSub({ ...sub, endpoint: "https://127.0.0.1:3333/api/run" })).toBe(false);
  expect(validSub({ ...sub, endpoint: "https://evil.push.apple.com.attacker.net/x" })).toBe(false);
  expect(validSub({ ...sub, keys: { ...sub.keys, auth: "short" } })).toBe(false);
});

test("each send is signed with the server's VAPID key, for that push service, as ES256", async () => {
  const { vapidHeader } = await import("../push");
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const v = { pub: Buffer.from(await crypto.subtle.exportKey("raw", k.publicKey)).toString("base64url"), priv: (await crypto.subtle.exportKey("jwk", k.privateKey)).d! };
  const h = await vapidHeader(v, "https://web.push.apple.com/abc");
  const [, jwt, pub] = /^vapid t=([^,]+), k=(.+)$/.exec(h)!;
  expect(pub).toBe(v.pub);
  const [head, body, sig] = jwt.split(".");
  expect(JSON.parse(Buffer.from(body, "base64url").toString()).aud).toBe("https://web.push.apple.com");
  expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k.publicKey, Buffer.from(sig, "base64url"), new TextEncoder().encode(`${head}.${body}`))).toBe(true);
});

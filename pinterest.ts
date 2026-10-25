// Pinterest (só leitura, só da conta que autorizou): imagens de uma pasta para o carrossel da Home.
// Segredos e tokens vivem no .env (fora do git) (fora do git). Nada daqui é logado; o front nunca fala com o Pinterest.
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

const DIR = import.meta.dir;
const ENV = `${DIR}/.env`;
const CACHE = `${DIR}/cache/pinterest`;
const INDICE = `${CACHE}/index.json`;
const API = "https://api.pinterest.com/v5";
const SEIS_HORAS = 6 * 3600_000;

type Pin = { id: string; link: string; titulo: string; cor: string };
type Estado = { status: "ok" | "sem-config" | "desconectado" | "erro"; erro: string; ultima: string; sincronizando: boolean; imagens: Pin[] };

let redirect = "";
let estado: Estado = { status: "sem-config", erro: "", ultima: "", sincronizando: false, imagens: [] };
let pausado = false; // erro de configuração (403): não tenta de novo sozinho, só pelo botão
let ultimoLog = "";
const estados = new Set<string>(); // "state" do OAuth em andamento

const logUmaVez = (msg: string) => { if (msg !== ultimoLog) { console.error(`pinterest: ${msg}`); ultimoLog = msg; } };

function lerEnv(): Record<string, string> {
  try {
    return Object.fromEntries(readFileSync(ENV, "utf8").split("\n").filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
  } catch { return {}; }
}
function salvarEnv(novos: Record<string, string>) {
  const linhas = existsSync(ENV) ? readFileSync(ENV, "utf8").split("\n") : [];
  for (const [k, v] of Object.entries(novos)) {
    const i = linhas.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) linhas[i] = `${k}=${v}`; else linhas.push(`${k}=${v}`);
  }
  writeFileSync(ENV, linhas.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 });
}
const credenciais = () => { const e = lerEnv(); return e.PINTEREST_CLIENT_ID && e.PINTEREST_CLIENT_SECRET ? e : null; };
const basic = (e: Record<string, string>) => "Basic " + Buffer.from(`${e.PINTEREST_CLIENT_ID}:${e.PINTEREST_CLIENT_SECRET}`).toString("base64");

async function pedirToken(corpo: Record<string, string>) {
  const e = credenciais()!;
  const r = await fetch(`${API}/oauth/token`, {
    method: "POST", headers: { Authorization: basic(e), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(corpo),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`token recusado (${r.status} ${j.code ?? ""})`.trim());
  salvarEnv({
    PINTEREST_ACCESS_TOKEN: j.access_token,
    PINTEREST_EXPIRES_AT: String(Date.now() + (j.expires_in ?? 2592000) * 1000),
    ...(j.refresh_token ? { PINTEREST_REFRESH_TOKEN: j.refresh_token } : {}),
  });
}

// Token válido, renovando quando falta menos de 1 dia. Sem refresh que funcione: "desconectado" (reconectar).
async function token() {
  const e = lerEnv();
  if (!e.PINTEREST_ACCESS_TOKEN) throw Object.assign(new Error("sem token: conecte o Pinterest"), { desconectado: true });
  // Token de teste colado à mão (página do app) não traz validade: vale até o Pinterest responder 401.
  if (!e.PINTEREST_EXPIRES_AT || Number(e.PINTEREST_EXPIRES_AT) - Date.now() > 86400_000) return e.PINTEREST_ACCESS_TOKEN;
  if (!e.PINTEREST_REFRESH_TOKEN) throw Object.assign(new Error("token expirado e sem refresh: reconecte"), { desconectado: true });
  try { await pedirToken({ grant_type: "refresh_token", refresh_token: e.PINTEREST_REFRESH_TOKEN }); }
  catch { throw Object.assign(new Error("refresh recusado: reconecte o Pinterest"), { desconectado: true }); }
  return lerEnv().PINTEREST_ACCESS_TOKEN;
}

async function get(caminho: string): Promise<any> {
  const r = await fetch(`${API}${caminho}`, { headers: { Authorization: `Bearer ${await token()}` } });
  const j: any = await r.json().catch(() => ({}));
  if (r.status === 401 && j.code === 3)
    throw Object.assign(new Error("Trial pendente no Pinterest (code 3): use \"usuario/pasta\" em pinterest.json para ler via RSS público"), { configuracao: true });
  if (r.status === 401) throw Object.assign(new Error("token inválido: reconecte o Pinterest"), { desconectado: true });
  if (r.status === 403 && /PINNER_DATA_ACCESS_DENIED/.test(JSON.stringify(j)))
    throw Object.assign(new Error("PINNER_DATA_ACCESS_DENIED: o app só lê pastas da conta que autorizou"), { configuracao: true });
  if (!r.ok) throw new Error(`Pinterest respondeu ${r.status} ${j.message ?? ""}`.trim());
  return j;
}
async function todos(caminho: string) {
  const itens: any[] = [];
  let bookmark = "";
  do {
    const j = await get(`${caminho}${caminho.includes("?") ? "&" : "?"}page_size=100${bookmark ? `&bookmark=${encodeURIComponent(bookmark)}` : ""}`);
    itens.push(...(j.items ?? []));
    bookmark = j.bookmark ?? "";
  } while (bookmark && itens.length < 2000);
  return itens;
}

// Filtra imagens pequenas (<720x600), GIFs ou prints verticais estreitos de celular (ratio < 0.72) que ficam esticados nos cards.
const imagemBoa = (w: number, h: number, url: string) => w >= 720 && h >= 600 && w / h >= 0.72 && !/\.gif($|\?)/i.test(url);

// Pasta pública (https://br.pinterest.com/<usuario>/<pasta>/): lê os pins do SSR (__PWS_INITIAL_PROPS__) sem precisar de OAuth nem Trial aprovado.
// ponytail: faz 3 leituras paralelas (o SSR amostra ~25 pins por request) e mescla por hash; quando o Trial aprovar, a API v5 pagina tudo.
async function pinsPublicos(caminho: string): Promise<{ id: string; url: string; link: string; titulo: string; cor: string }[]> {
  const limpo = caminho.replace(/^https?:\/\/[^/]+\//, "").replace(/\/?(\.rss)?$/, "");
  const map = new Map<string, { id: string; url: string; link: string; titulo: string; cor: string }>();
  const htmls = await Promise.all([0, 1, 2].map(async () => {
    const r = await fetch(`https://br.pinterest.com/${limpo}/`);
    if (!r.ok) throw Object.assign(new Error(`Pasta "${limpo}" respondeu ${r.status} (confira se é pública)`), { configuracao: true });
    return r.text();
  }));
  for (const html of htmls) {
    const m = html.match(/<script[^>]*id="__PWS_INITIAL_PROPS__"[^>]*>([\s\S]*?)<\/script>/);
    const pinsObj = m ? (JSON.parse(m[1])?.initialReduxState?.pins ?? {}) : {};
    for (const [pid, p] of Object.entries<any>(pinsObj)) {
      const orig = p?.images?.orig ?? p?.images?.["736x"] ?? {};
      const url: string = orig.url ?? "";
      const hash = url.match(/\/([0-9a-f]{16,64})\.\w+$/)?.[1];
      if (!url || !hash || !imagemBoa(Number(orig.width) || 0, Number(orig.height) || 0, url)) continue;
      const titulo = String(p.title || p.grid_title || p.description || p.auto_alt_text || "").trim().slice(0, 140);
      map.set(hash, { id: hash, url, link: `https://www.pinterest.com/pin/${pid}/`, titulo, cor: p.dominant_color ?? "" });
    }
  }
  return [...map.values()];
}

export async function sincronizar(manual = false) {
  if (estado.sincronizando || (pausado && !manual)) return estado;
  const cfg = (() => { try { return JSON.parse(readFileSync(`${DIR}/pinterest.json`, "utf8")); } catch { return {}; } })();
  const publico = typeof cfg.board === "string" && cfg.board.includes("/");
  if (!publico && !credenciais() && !lerEnv().PINTEREST_ACCESS_TOKEN) { estado.status = "sem-config"; return estado; }
  estado.sincronizando = true;
  try {
    mkdirSync(CACHE, { recursive: true });
    const pins: Pin[] = [];
    if (publico) {
      for (const p of await pinsPublicos(cfg.board)) {
        const arq = `${CACHE}/${p.id}.jpg`;
        if (!existsSync(arq)) {
          const r = await fetch(p.url);
          if (!r.ok) continue;
          await Bun.write(arq, r);
          Bun.spawnSync(["magick", `${arq}[0]`, "-resize", "1800x1800>", "-quality", "82", arq]);
        }
        pins.push({ id: p.id, link: p.link, titulo: p.titulo, cor: p.cor });
      }
    } else {
      const alvo = String(cfg.board ?? "").toLowerCase();
      const board = (await todos("/boards")).find((b) => b.id === cfg.board || b.name?.toLowerCase() === alvo || b.name?.toLowerCase().replace(/\s+/g, "-") === alvo);
      if (!board) throw new Error(`pasta "${cfg.board}" não encontrada na sua conta (pinterest.json)`);
      for (const p of await todos(`/boards/${board.id}/pins`)) {
        const imgs = Object.values(p.media?.images ?? {}) as { url: string; width: number; height: number }[];
        const maior = imgs.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
        if (!maior?.url || !/^\d+$/.test(p.id) || !imagemBoa(maior.width ?? 0, maior.height ?? 0, maior.url)) continue;
        const arq = `${CACHE}/${p.id}.jpg`;
        if (!existsSync(arq)) {
          const r = await fetch(maior.url);
          if (!r.ok) continue;
          await Bun.write(arq, r);
          Bun.spawnSync(["magick", `${arq}[0]`, "-resize", "1800x1800>", "-quality", "82", arq]); // sem ImageMagick, fica o original
        }
        pins.push({ id: p.id, link: `https://www.pinterest.com/pin/${p.id}/`, titulo: String(p.title || p.alt_text || p.description || "").slice(0, 140), cor: p.dominant_color ?? "" });
      }
    }
    const vivos = new Set(pins.flatMap((p) => [`${p.id}.jpg`, `${p.id}-amb.jpg`]));
    for (const f of readdirSync(CACHE)) if (f.endsWith(".jpg") && !vivos.has(f)) unlinkSync(`${CACHE}/${f}`); // saiu da pasta, sai do cache
    estado = { status: "ok", erro: "", ultima: new Date().toISOString(), sincronizando: false, imagens: pins };
    writeFileSync(INDICE, JSON.stringify({ ultima: estado.ultima, pins }, null, 1));
    pausado = false; ultimoLog = "";
  } catch (e: any) {
    estado.sincronizando = false;
    estado.erro = e.message;
    estado.status = e.desconectado ? "desconectado" : "erro";
    if (e.configuracao) pausado = true;
    logUmaVez(e.message);
  }
  return estado;
}

export function iniciarPinterest(urlRetorno: string) {
  redirect = urlRetorno;
  try { const i = JSON.parse(readFileSync(INDICE, "utf8")); estado.imagens = i.pins ?? []; estado.ultima = i.ultima ?? ""; } catch {}
  estado.status = lerEnv().PINTEREST_ACCESS_TOKEN ? "ok" : !credenciais() ? "sem-config" : "desconectado";
  sincronizar();
  setInterval(() => sincronizar(), SEIS_HORAS);
}

export const estadoPinterest = () => {
  const board = (() => { try { return JSON.parse(readFileSync(`${DIR}/pinterest.json`, "utf8")).board ?? ""; } catch { return ""; } })();
  return { ...estado, total: estado.imagens.length, board, redirect };
};

export async function arquivoPin(id: string, amb = false) {
  if (!/^[0-9a-f]+$/.test(id)) return null;
  const orig = `${CACHE}/${id}.jpg`;
  if (!(await Bun.file(orig).exists())) return null;
  if (!amb) return Bun.file(orig);
  const out = `${CACHE}/${id}-amb.jpg`;
  if (!(await Bun.file(out).exists())) {
    Bun.spawnSync(["magick", `${orig}[0]`, "-resize", "160x160>", "-blur", "0x5", "-modulate", "50,135", "-quality", "78", out]);
    if (!(await Bun.file(out).exists())) return Bun.file(orig);
  }
  return Bun.file(out);
}

// OAuth: /auth/pinterest manda para o Pinterest; o callback confere o "state" e troca o código por tokens.
export function urlAutorizacao() {
  const e = credenciais();
  if (!e) return null;
  const st = randomBytes(16).toString("hex");
  estados.add(st);
  setTimeout(() => estados.delete(st), 600_000);
  return `https://www.pinterest.com/oauth/?${new URLSearchParams({ client_id: e.PINTEREST_CLIENT_ID, redirect_uri: redirect, response_type: "code", scope: "boards:read,pins:read", state: st })}`;
}
export async function retornoAutorizacao(url: URL) {
  const st = url.searchParams.get("state") ?? "", code = url.searchParams.get("code") ?? "";
  if (!estados.delete(st) || !code) return "Autorização inválida ou expirada. Volte ao Overlook e tente de novo.";
  try {
    await pedirToken({ grant_type: "authorization_code", code, redirect_uri: redirect, continuous_refresh: "true" });
  } catch (e: any) { logUmaVez(e.message); return `O Pinterest recusou: ${e.message}`; }
  pausado = false;
  await sincronizar(true);
  return "";
}

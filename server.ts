// Overlook, o painel do vault: lê o markdown direto do disco a cada request. Sem banco, sem cache.
// ponytail: varre o vault inteiro por request; ok até milhares de notas, cache por mtime se ficar lento.
//   bun server.ts        -> serve http://127.0.0.1:3333
//   bun server.ts mapa   -> uma linha por nota, para agentes se orientarem
//   bun server.ts hoje   -> o que o Overlook mostra, em texto curto para agente
import { resolve, basename, dirname, extname } from "node:path";
import { readdirSync, readlinkSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Database } from "bun:sqlite";
import { iniciarPinterest, sincronizar, estadoPinterest, arquivoPin, urlAutorizacao, retornoAutorizacao } from "./pinterest";

const RAIZ = resolve(process.env.VAULT_DIR || `${homedir()}/dev/obsidian-study-vault`);
const PORTA = Number(process.env.PORT) || 3333;
// Nome da máquina no Tailscale, lido na hora: sobrevive a renomear a máquina (arch -> cachyos já aconteceu).
const TAILNET = (() => {
  try { return JSON.parse(Bun.spawnSync(["tailscale", "status", "--json"]).stdout.toString()).Self.DNSName.replace(/\.$/, ""); } catch { return ""; }
})();
// Host aceito: loopback na porta certa ou o nome do tailnet (barra DNS rebinding sem travar o celular).
const hostOk = (h: string, porta: number) =>
  h === `127.0.0.1:${porta}` || h === `localhost:${porta}` || (!!TAILNET && (h === TAILNET || h.startsWith(`${TAILNET}:`)));
const VAULT = basename(RAIZ);
const ARTE = resolve(process.env.ART_DIR || `${homedir()}/Pictures/Wallpapers`); // arte dos cards quando não há Pinterest
const ROTINAS: Record<string, string> = {
  "bom-dia": "Siga a rotina bom-dia da seção Rotinas do AGENTS.md.",
  inbox: "Siga a rotina inbox da seção Rotinas do AGENTS.md.",
};

type Nota = {
  path: string; titulo: string; pasta: string; tipo: string; area: string; tags: string[];
  resumo: string; revisar_em: string; intervalo: number; mtime: number; links: string[];
};

const hoje = (dias = 0) => new Date(Date.now() + dias * 864e5).toLocaleDateString("sv");
const agora = () => new Date().toLocaleString("sv").slice(0, 16);

function frontmatter(txt: string) {
  const m = txt.match(/^---\n([\s\S]*?)\n---\n?/);
  const fm: Record<string, string> = {};
  for (const l of m?.[1].split("\n") ?? []) {
    const k = l.match(/^(\w+):\s*(.*)$/);
    if (k) fm[k[1]] = k[2].replace(/^["']|["']$/g, "");
  }
  return { fm, corpo: m ? txt.slice(m[0].length) : txt };
}

// Notas do usuário: pastas 1-8, menos desenhos e templates.
async function notas(): Promise<Nota[]> {
  const out: Nota[] = [];
  for await (const path of new Bun.Glob("*/*.md").scan(RAIZ)) {
    const pasta = dirname(path);
    if (!/^[1-8] /.test(pasta) || pasta.startsWith("7 ") || path.endsWith(".excalidraw.md") || basename(path).startsWith("_")) continue;
    const f = Bun.file(`${RAIZ}/${path}`);
    const { fm, corpo } = frontmatter(await f.text());
    out.push({
      path, pasta,
      titulo: corpo.match(/^# (.+)$/m)?.[1] ?? basename(path, ".md"),
      tipo: fm.tipo ?? "", area: fm.area ?? "",
      tags: (fm.tags ?? "").replace(/[\[\]]/g, "").split(",").map((t) => t.trim()).filter(Boolean),
      resumo: corpo.match(/> \[!abstract\][^\n]*\n> (.+)/)?.[1] ?? "",
      revisar_em: fm.revisar_em ?? "", intervalo: Number(fm.intervalo) || 0,
      mtime: f.lastModified,
      links: [...corpo.matchAll(/\[\[([^\]|#^]+)/g)].map((x) => x[1].trim().split("/").pop()!),
    });
  }
  return out;
}

// Link vermelho: alvo que não existe como .md em lugar nenhum do vault.
async function vermelhos(ns: Nota[]) {
  const existe = new Set<string>();
  for await (const p of new Bun.Glob("**/*.md").scan(RAIZ)) if (!p.startsWith(".")) existe.add(basename(p, ".md"));
  const n = new Map<string, number>();
  for (const a of ns.flatMap((x) => x.links)) {
    if (!existe.has(a) && !/\.(base|canvas|excalidraw)$/.test(a)) n.set(a, (n.get(a) ?? 0) + 1);
  }
  return [...n].map(([alvo, n]) => ({ alvo, n })).sort((a, b) => b.n - a.n);
}

const linhas = async (rel: string) => {
  const f = Bun.file(`${RAIZ}/${rel}`);
  return (await f.exists()) ? (await f.text()).split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2)) : [];
};

// Seção "## X" da nota do dia, em bullets.
async function secao(nome: string) {
  const f = Bun.file(`${RAIZ}/2 Diário/${hoje()}.md`);
  if (!(await f.exists())) return null;
  const sec = (await f.text()).match(new RegExp(`^## ${nome}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m"))?.[1] ?? "";
  return sec.split("\n").filter((l) => /^\s*- /.test(l)).map((l) => l.replace(/^\s*- (\[.\] )?/, ""));
}

async function estado() {
  const ns = await notas();
  const diarias: string[] = [];
  for await (const p of new Bun.Glob("2 Diário/????-??-??.md").scan(RAIZ)) diarias.push(basename(p, ".md"));
  return {
    vault: VAULT, hoje: hoje(), foco: await secao("Foco de hoje"), capturas: await secao("Capturei"), diarias,
    notas: ns, vermelhos: (await vermelhos(ns)).slice(0, 10),
    log: (await linhas("9 Agente/Log.md")).slice(-30).reverse(),
    achados: await linhas("9 Agente/Achados.md"),
    arte: arte().length,
    pins: estadoPinterest().imagens,
  };
}

// Revisão espaçada, regra do AGENTS.md: lembrou dobra o intervalo, esqueceu volta para 1.
async function revisar(path: string, lembrou: boolean) {
  const nota = (await notas()).find((n) => n.path === path); // só caminhos conhecidos: nada de ../
  if (!nota) return null;
  const intervalo = lembrou ? Math.max(1, nota.intervalo * 2) : 1;
  const revisar_em = hoje(intervalo);
  const f = Bun.file(`${RAIZ}/${path}`);
  const txt = (await f.text()).replace(/^---\n([\s\S]*?)\n---/, (_, fm: string) => {
    const set = (s: string, k: string, v: string | number) =>
      new RegExp(`^${k}:`, "m").test(s) ? s.replace(new RegExp(`^${k}:.*$`, "m"), `${k}: ${v}`) : `${s}\n${k}: ${v}`;
    return `---\n${set(set(fm, "revisar_em", revisar_em), "intervalo", intervalo)}\n---`;
  });
  await Bun.write(f, txt);
  return { revisar_em, intervalo };
}

// Nota renderizada para o leitor do Overlook. Wikilink vira rota interna; embed vira aviso.
async function nota(path: string) {
  const ns = await notas();
  const n = ns.find((x) => x.path === path);
  if (!n) return null;
  const { corpo } = frontmatter(await Bun.file(`${RAIZ}/${path}`).text());
  const md = corpo
    .replace(/^# .+\n/m, "")
    .replace(/!\[\[([^\]]+)\]\]/g, (_, a) => `*Desenho: ${a.replace(/\.excalidraw(\.md)?$/, "")} (abra no Obsidian)*`)
    .replace(/\[\[([^\]|#^]+)[^\]|]*(?:\|([^\]]+))?\]\]/g, (_, a, b) => `[${b ?? a}](#/w/${encodeURIComponent(a.trim())})`);
  const nome = basename(path, ".md");
  return {
    ...n, html: Bun.markdown.html(md),
    backlinks: ns.filter((x) => x.links.includes(nome)).map(({ path, titulo }) => ({ path, titulo })),
  };
}

// Captura vai para "## Capturei" da nota do dia (AGENTS.md: captura não é nota permanente).
async function capturar(texto: string) {
  const rel = `2 Diário/${hoje()}.md`;
  const f = Bun.file(`${RAIZ}/${rel}`);
  const modelo = Bun.file(`${RAIZ}/2 Diário/_Template.md`);
  const ls = ((await f.exists()) ? await f.text() : (await modelo.exists()) ? await modelo.text() : "## Capturei\n").split("\n");
  let i = ls.indexOf("## Capturei");
  if (i < 0) { ls.push("", "## Capturei"); i = ls.length - 1; }
  let j = i + 1;
  while (j < ls.length && !ls[j].startsWith("## ")) j++;
  while (j > i + 1 && !ls[j - 1].trim()) j--; // entra depois do último item, antes da linha em branco
  ls.splice(j, 0, `- ${texto.replace(/\s+/g, " ").trim()}`);
  await Bun.write(f, ls.join("\n"));
}

// Wallpaper em 4K pesa no navegador e no Tailscale: serve uma cópia de 1600px, gerada uma vez.
// ponytail: gera no primeiro pedido e trava o servidor ~0,3 s por imagem; pré-gerar se incomodar.
const CACHE = `${homedir()}/.cache/hq-arte`;
// "amb" é o fundo ambiente: minúsculo, já desfocado e escurecido, para o CSS não precisar de filter (custava ~10 fps).
async function miniatura(nome: string, amb: boolean) {
  const out = `${CACHE}/${nome.replace(/\.\w+$/, "")}${amb ? "-amb" : ""}.jpg`;
  if (!(await Bun.file(out).exists())) {
    mkdirSync(CACHE, { recursive: true });
    const args = amb ? ["-resize", "160x160>", "-blur", "0x5", "-modulate", "50,135"] : ["-resize", "1600x1600>"];
    if (Bun.spawnSync(["magick", `${ARTE}/${nome}`, ...args, "-quality", "78", out]).exitCode !== 0) return Bun.file(`${ARTE}/${nome}`);
  }
  return Bun.file(out);
}

function arte() {
  try { return readdirSync(ARTE).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort(); } catch { return []; }
}

// Agentes vivos: processos claude/agy/codex/gemini, com a pasta onde rodam.
// "chave" identifica a conversa (c:<sessão> no Claude, g:<conversa> no AGY): a página do agente sobrevive ao processo.
const NOMES = /^(claude|agy|codex|gemini)$/;
const CLAUDE = Bun.which("claude") ?? `${homedir()}/.local/bin/claude`, AGY = Bun.which("agy") ?? `${homedir()}/.local/bin/agy`;
const AGY_BASE = `${homedir()}/.gemini/antigravity-cli`;
const rodando = new Map<string, { inicio: string; pid: number; fim?: string; ok?: boolean }>();
const lerJson = (f: string) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return null; } };
function agentes() {
  const out = Bun.spawnSync(["ps", "-eo", "pid=,etimes=,comm="]).stdout.toString();
  const agyConversas = lerJson(`${AGY_BASE}/cache/last_conversations.json`) ?? {};
  return out.trim().split("\n").map((l) => l.trim().split(/\s+/)).filter(([, , c]) => NOMES.test(c)).map(([pid, et, comm]) => {
    let cwd = ""; try { cwd = readlinkSync(`/proc/${pid}/cwd`); } catch {}
    const sid = comm === "claude" ? lerJson(`${homedir()}/.claude/sessions/${pid}.json`)?.sessionId : comm === "agy" ? agyConversas[cwd] : null;
    return { pid: Number(pid), nome: comm, segundos: Number(et), cwd: cwd.replace(homedir(), "~"), chave: sid ? `${comm === "agy" ? "g" : "c"}:${sid}` : "" };
  }).filter((a) => a.nome !== "claude" || a.chave); // claude sem sessão é CLI de passagem (ex.: o `claude agents` que o próprio Overlook roda)
}

// Sessões do Claude, inclusive as em segundo plano sem processo (`claude agents --json`). Cache de 15 s: o CLI custa ~0,5 s.
let sessoesCache = { t: 0, lista: [] as any[] };
async function sessoesClaude() {
  if (Date.now() - sessoesCache.t < 15000) return sessoesCache.lista;
  try {
    const p = Bun.spawn([CLAUDE, "agents", "--json", "--all"], { stdout: "pipe", stderr: "ignore" });
    sessoesCache = { t: Date.now(), lista: JSON.parse(await new Response(p.stdout).text()) };
  } catch { sessoesCache.t = Date.now(); }
  return sessoesCache.lista;
}
async function emSegundoPlano() {
  return (await sessoesClaude()).filter((x) => x.kind === "background" && !x.pid).sort((a, b) => b.startedAt - a.startedAt).slice(0, 8)
    .map((x) => ({ chave: `c:${x.sessionId}`, titulo: x.name ?? x.id, estado: x.state ?? "", cwd: String(x.cwd ?? "").replace(homedir(), "~"), desde: x.startedAt,
      precisa: x.state === "blocked" ? lerJson(`${homedir()}/.claude/jobs/${x.id}/state.json`)?.needs ?? "" : "" }));
}

type Servico = { id: string; nome: string; url: string; desc: string; icone?: string; dock?: boolean; largura?: number; proxy?: number; interno?: string };
// servicos.json é pessoal (fora do git); sem ele, a lista fica vazia.
const listaServicos = (): Promise<Servico[]> => Bun.file(`${import.meta.dir}/servicos.json`).json().catch(() => []);

// O que um agente está fazendo, lido da conversa dele no disco. Só leitura.
type Evento = { t: "voce" | "texto" | "ferramenta" | "resultado"; txt: string; nome?: string; quando?: string };
const corta = (s: string, n = 600) => (s.length > n ? s.slice(0, n) + "…" : s);
const ID = /^[0-9a-f-]{8,64}$/; // sessão/conversa vira caminho de arquivo: só hex e hífen, nada de ../

async function conversaClaude(sessionId: string): Promise<Evento[]> {
  let caminho = "";
  for await (const p of new Bun.Glob(`*/${sessionId}.jsonl`).scan(`${homedir()}/.claude/projects`)) { caminho = `${homedir()}/.claude/projects/${p}`; break; }
  if (!caminho) return [];
  const f = Bun.file(caminho);
  // ponytail: lê só o último 1 MB da conversa; o suficiente para os eventos recentes.
  const txt = await f.slice(Math.max(0, f.size - 1_000_000)).text();
  const ev: Evento[] = [];
  for (const l of txt.split("\n").slice(1)) {
    let d: any; try { d = JSON.parse(l); } catch { continue; }
    if (d.isMeta || !d.message || (d.type !== "user" && d.type !== "assistant")) continue; // cópias internas (api-request-blob etc.) ficam de fora
    const quando = d.timestamp, c = d.message.content;
    const itens = typeof c === "string" ? [{ type: "text", text: c }] : Array.isArray(c) ? c : [];
    for (const x of itens) {
      if (x.type === "text" && x.text?.trim() && !x.text.startsWith("<")) ev.push({ t: d.type === "user" ? "voce" : "texto", txt: corta(x.text.trim(), 1500), quando });
      else if (x.type === "tool_use") {
        const i = x.input ?? {};
        ev.push({ t: "ferramenta", nome: x.name, txt: corta(String(i.description ?? i.command ?? i.file_path ?? i.pattern ?? i.url ?? i.prompt ?? JSON.stringify(i)), 300), quando });
      } else if (x.type === "tool_result") {
        const r = Array.isArray(x.content) ? x.content.map((y: any) => y.text ?? "").join(" ") : String(x.content ?? "");
        if (r.trim()) ev.push({ t: "resultado", txt: corta(r.trim(), 400), quando });
      }
    }
  }
  return ev.slice(-80);
}

// AGY guarda passos em protobuf sem esquema público: extrai os trechos legíveis de cada passo.
// ponytail: heurística por texto; se o formato do AGY mudar, isto mostra menos, não quebra.
async function conversaAgy(id: string): Promise<Evento[]> {
  const arq = `${AGY_BASE}/conversations/${id}.db`;
  if (!id || !(await Bun.file(arq).exists())) return [];
  const db = new Database(arq, { readonly: true });
  try {
    const rows = db.query("select step_type, step_payload from steps order by idx desc limit 120").all() as { step_type: number; step_payload: Uint8Array }[];
    const ev: Evento[] = [];
    for (const r of rows.reverse()) {
      const partes = new TextDecoder().decode(r.step_payload ?? new Uint8Array()).match(/[\p{L}\p{N}\p{P}\p{Zs}\n`$/~<>=+|*-]{12,}/gu) ?? [];
      const frases = partes.map((p) => p.replace(/^[^\p{L}`*\/(\[]+/u, "").replace(/["Z\s]+$/, "").trim())
        .filter((p) => p.split(" ").length > 3 && !/"\w+":/.test(p)); // fora o JSON de chamada de ferramenta
      if (r.step_type === 14 && frases.length) ev.push({ t: "voce", txt: corta(frases[frases.length - 1]) });
      else if (r.step_type === 132) {
        const j = partes.find((p) => p.includes("{"));
        let det = ""; try { const o = JSON.parse(j!.slice(j!.indexOf("{"), j!.lastIndexOf("}") + 1)); det = o.toolSummary ?? o.CommandLine ?? o.Path ?? ""; } catch {}
        const nome = new TextDecoder().decode(r.step_payload).match(/call_\d+[^a-z_]*([a-z_]{3,})/)?.[1] ?? "ferramenta";
        ev.push({ t: "ferramenta", nome, txt: corta(String(det || j || "").replace(homedir(), "~"), 300) });
      } else if (r.step_type === 15 && frases.length) ev.push({ t: "texto", txt: corta(frases[frases.length - 1], 1500) });
    }
    return ev.slice(-80);
  } finally { db.close(); }
}

async function agente(chave: string) {
  const tipo = chave.slice(0, 2), id = chave.slice(2);
  if ((tipo !== "c:" && tipo !== "g:") || !ID.test(id)) return null;
  const vivo = agentes().find((a) => a.chave === chave);
  if (tipo === "g:") {
    const eventos = await conversaAgy(id);
    if (!eventos.length && !vivo) return null;
    const pasta = Object.entries(lerJson(`${AGY_BASE}/cache/last_conversations.json`) ?? {}).find(([, v]) => v === id)?.[0] ?? "";
    return { nome: "agy", chave, vivo: !!vivo, pid: vivo?.pid, segundos: vivo?.segundos, cwd: vivo?.cwd ?? pasta.replace(homedir(), "~"), eventos };
  }
  let eventos = await conversaClaude(id);
  const s = (await sessoesClaude()).find((x) => x.sessionId === id);
  // Sessão em segundo plano guarda estado e linha do tempo em ~/.claude/jobs/<id curto>; serve quando a conversa já foi apagada.
  const job = lerJson(`${homedir()}/.claude/jobs/${id.slice(0, 8)}/state.json`);
  if (!eventos.length) {
    const tl = await Bun.file(`${homedir()}/.claude/jobs/${id.slice(0, 8)}/timeline.jsonl`).text().catch(() => "");
    eventos = tl.split("\n").flatMap((l) => { try { const d = JSON.parse(l); return [{ t: "texto" as const, txt: corta(d.text || `${d.state}: ${d.detail}`, 1500), quando: d.at }]; } catch { return []; } }).slice(-80);
  }
  if (!eventos.length && !vivo && !s) return null;
  return { nome: "claude", chave, vivo: !!vivo, pid: vivo?.pid, segundos: vivo?.segundos, cwd: vivo?.cwd ?? String(s?.cwd ?? "").replace(homedir(), "~"),
    titulo: s?.name, estado: s?.state, precisa: job?.needs ?? "", eventos };
}

// Falar com o agente. Claude: `claude --bg --resume` continua a sessão em segundo plano; se ela estiver aberta num
// terminal, ele cria uma cópia (o terminal fica intacto) e devolve o id dela. AGY: `agy -p --conversation`.
async function falar(chave: string, texto: string) {
  const a = await agente(chave);
  if (!a) return null;
  const cwd = a.cwd.replace(/^~/, homedir()) || homedir();
  if (a.nome === "agy") {
    Bun.spawn([AGY, "-p", texto, "--conversation", chave.slice(2), "--mode", "auto", "--print-timeout", "10m"], { cwd, stdout: "ignore", stderr: "ignore" });
    return { chave };
  }
  const p = Bun.spawn([CLAUDE, "--bg", "--resume", chave.slice(2), texto], { cwd, stdout: "pipe", stderr: "pipe" });
  const saida = (await new Response(p.stdout).text()) + (await new Response(p.stderr).text());
  await p.exited;
  sessoesCache.t = 0;
  const curto = saida.match(/\b[0-9a-f]{8}\b/)?.[0];
  const nova = curto ? (await sessoesClaude()).find((x) => x.id === curto || String(x.sessionId).startsWith(curto)) : null;
  return { chave: nova ? `c:${nova.sessionId}` : chave, saida: corta(saida.trim(), 300) };
}

async function servicos() {
  const lista = await listaServicos();
  return Promise.all(lista.map(async (s) => {
    if (s.interno === "pinterest") { const p = estadoPinterest(); return { ...s, ok: p.status === "ok", ms: 0, pinterest: p }; } // não é localhost: o status vem da sincronização
    const t = performance.now();
    try {
      const r = await fetch(s.url, { signal: AbortSignal.timeout(1500) });
      return { ...s, ok: r.ok, ms: Math.round(performance.now() - t) };
    } catch { return { ...s, ok: false, ms: 0 }; }
  }));
}

// Rotina roda no AGY em modo print: o trabalho braçal não gasta token do Claude.
function rodar(nome: string) {
  const antes = rodando.get(nome);
  if (!ROTINAS[nome] || (antes && !antes.fim)) return false;
  const p = Bun.spawn([AGY, "-p", ROTINAS[nome], "--mode", "auto", "--print-timeout", "10m"], {
    cwd: RAIZ, stdout: Bun.file(`/tmp/hq-${nome}.log`), stderr: "inherit",
  });
  const r = { inicio: agora(), pid: p.pid } as { inicio: string; pid: number; fim?: string; ok?: boolean };
  rodando.set(nome, r);
  p.exited.then((c) => { r.fim = agora(); r.ok = c === 0; });
  return true;
}

const cmd = process.argv[2];
if (cmd === "mapa") {
  for (const n of (await notas()).sort((a, b) => a.path.localeCompare(b.path)))
    console.log(`${n.path} · ${n.tipo || "-"} · ${n.resumo || "(sem resumo)"}`);
  process.exit(0);
}
if (cmd === "agy") { // bun server.ts agy <pasta>: o que o AGY fez na última conversa daquela pasta
  for (const e of await conversaAgy(lerJson(`${AGY_BASE}/cache/last_conversations.json`)?.[resolve(process.argv[3] ?? RAIZ)] ?? "")) console.log(`${e.t.padEnd(10)} ${e.nome ?? ""} ${e.txt.replace(/\n/g, " ").slice(0, 160)}`);
  process.exit(0);
}
if (cmd === "hoje") {
  const e = await estado();
  const lista = (t: string, xs: string[]) => console.log(`${t}:\n${xs.map((x) => `  ${x}`).join("\n") || "  (nada)"}`);
  console.log(`hoje: ${e.hoje} · nota do dia: ${e.foco ? "existe" : "não existe"}`);
  lista("foco", e.foco ?? []);
  lista("capturas", e.capturas ?? []);
  lista("revisar", e.notas.filter((n) => n.revisar_em && n.revisar_em <= e.hoje).map((n) => `${n.revisar_em} ${n.path}`));
  lista("inbox", e.notas.filter((n) => n.pasta.startsWith("1 ")).map((n) => n.path));
  lista("lacunas", e.vermelhos.map((v) => `${v.n}× ${v.alvo}`));
  lista("projetos", e.notas.filter((n) => n.tipo === "projeto").map((n) => `${n.path} · ${n.resumo}`));
  lista("log", e.log.slice(0, 5));
  process.exit(0);
}

const json = (x: unknown) => (x ? Response.json(x) : new Response("não encontrado", { status: 404 }));
const ESTATICO = new Set(["/app.js", "/app.css"]);
const GRAFITE = new Set(["/grafite/app.js", "/grafite/app.css", "/grafite/tokens.css"]);
const PORTA_V2 = PORTA + 2;
// Página mínima de retorno do OAuth (texto escapado: a mensagem pode vir do Pinterest).
const pagina = (t: string, msg: string) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title>
<body style="background:#121212;color:#EAE8E3;font:15px/1.6 system-ui;display:grid;place-items:center;min-height:90vh;margin:0;padding:24px">
<main style="max-width:520px"><h1 style="font-weight:400">${t}</h1><p style="color:#A3A19C">${msg.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</p><p><a style="color:#F2B48C" href="/#/servicos">Voltar para Serviços →</a></p></main>`, { headers: { "content-type": "text/html; charset=utf-8" } });

iniciarPinterest(`${TAILNET ? `https://${TAILNET}` : `http://127.0.0.1:${PORTA}`}/auth/pinterest/callback`); // redirect HTTPS do Tailscale

async function tratar(req: Request, porta: number) {
  const url = new URL(req.url);
  const p = url.pathname;
  if (req.method === "POST") {
    // Contra site alheio postando no localhost: JSON força preflight (sem CORS aqui) e o Host barra DNS rebinding.
    if (req.headers.get("content-type") !== "application/json" || !hostOk(req.headers.get("host") ?? "", porta))
      return new Response("proibido", { status: 403 });
    const b = await req.json();
    if (p === "/api/revisar") return json(typeof b.path === "string" && (await revisar(b.path, !!b.lembrou)));
    if (p === "/api/capturar" && typeof b.texto === "string" && b.texto.trim()) { await capturar(b.texto.slice(0, 2000)); return json({ ok: true }); }
    if (p === "/api/falar") return typeof b.chave === "string" && typeof b.texto === "string" && b.texto.trim() ? json(await falar(b.chave, b.texto.trim().slice(0, 4000))) : new Response("faltou texto", { status: 400 });
    if (p === "/api/pinterest/sync") return json(await sincronizar(true));
    if (p === "/api/rotina") return rodar(b.nome) ? json({ ok: true }) : new Response("já rodando ou desconhecida", { status: 409 });
    return new Response("404", { status: 404 });
  }
  if (p === "/api") return json(await estado());
  if (p === "/api/pinterest") return json(estadoPinterest());
  if (p === "/api/nota") return json(await nota(url.searchParams.get("path") ?? ""));
  if (p === "/api/agente") return json(await agente(url.searchParams.get("chave") ?? ""));
  if (p === "/api/sistema") return json({ agentes: agentes(), fundo: await emSegundoPlano(), servicos: await servicos(), rotinas: Object.fromEntries(rodando) });
  if (p.startsWith("/arte/")) {
    const a = arte(), i = Number(p.slice(6));
    return Number.isInteger(i) && a.length
      ? new Response(await miniatura(a[i % a.length], url.searchParams.has("amb")), { headers: { "cache-control": "max-age=86400" } })
      : new Response("404", { status: 404 });
  }
  if (ESTATICO.has(p)) return new Response(Bun.file(`${import.meta.dir}${p}`));
  if (p === "/grafite" || p.startsWith("/silencio")) return Response.redirect("/grafite/", 301);
  if (p === "/grafite/") return new Response(Bun.file(`${import.meta.dir}/grafite/index.html`));
  if (GRAFITE.has(p)) return new Response(Bun.file(`${import.meta.dir}${p}`));
  if (p.startsWith("/v2")) return Response.redirect("/", 302);
  if (p.startsWith("/pin/")) { const f = await arquivoPin(p.slice(5), url.searchParams.has("amb")); return f ? new Response(f, { headers: { "cache-control": "max-age=86400" } }) : new Response("404", { status: 404 }); }
  if (p === "/auth/pinterest") { const u = urlAutorizacao(); return u ? Response.redirect(u, 302) : pagina("Falta configurar", "Preencha PINTEREST_CLIENT_ID e PINTEREST_CLIENT_SECRET no .env do Overlook e reinicie o servidor."); }
  if (p === "/auth/pinterest/callback") { const erro = await retornoAutorizacao(url); return pagina(erro ? "Não conectou" : "Pinterest conectado", erro || `${estadoPinterest().total} imagens no cache.`); }
  if (p === "/") return new Response(Bun.file(`${import.meta.dir}/index.html`));
  return new Response("404", { status: 404 });
}

Bun.serve({ hostname: "127.0.0.1", port: PORTA, fetch: (req) => tratar(req, PORTA) });
Bun.serve({ hostname: "127.0.0.1", port: PORTA_V2, fetch: (req) => tratar(req, PORTA_V2) });
console.log(`Overlook em http://127.0.0.1:${PORTA} · v2 em http://127.0.0.1:${PORTA_V2}`);

// Serviço que proíbe iframe (Grimoire: X-Frame-Options DENY) ganha um proxy que só libera o Overlook como moldura.
// O app embutido segue chamando a API direto no alvo; o Grimoire aceita porque 127.0.0.1:3334 está no
// CORS_ORIGINS do littleimpd.service.
for (const s of await listaServicos()) {
  if (!s.proxy) continue;
  const alvo = new URL(s.url);
  Bun.serve({
    hostname: "127.0.0.1", port: s.proxy,
    async fetch(req) {
      const host = req.headers.get("host") ?? "";
      if (!hostOk(host, s.proxy)) return new Response("proibido", { status: 403 });
      const u = new URL(req.url);
      const h = new Headers(req.headers);
      h.delete("host");
      const r = await fetch(alvo.origin + u.pathname + u.search, {
        method: req.method, headers: h, redirect: "manual",
        body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      });
      const rh = new Headers(r.headers);
      rh.delete("x-frame-options"); rh.delete("content-encoding"); rh.delete("content-length"); // fetch já descomprimiu
      const csp = rh.get("content-security-policy");
      if (csp) rh.set("content-security-policy", csp.replace("frame-ancestors 'none'", `frame-ancestors http://127.0.0.1:${PORTA} http://localhost:${PORTA} http://127.0.0.1:${PORTA_V2} http://localhost:${PORTA_V2}${TAILNET ? ` https://${TAILNET}` : ""}`));
      return new Response(r.body, { status: r.status, headers: rh });
    },
  });
  console.log(`proxy de ${s.nome} em http://127.0.0.1:${s.proxy}`);
}

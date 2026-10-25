// Vault, direção "Grafite". Mesmos dados, rotas e atalhos do HQ em /; muda a camada visual e entra o Pinterest no carrossel.
const $ = (s, el = document) => el.querySelector(s);
const main = $("#main");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const rel = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const somaDias = (d, n) => new Date(new Date(d + "T12:00").getTime() + n * 864e5).toLocaleDateString("sv");
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

let D = null; // vault
let S = { agentes: [], servicos: [], rotinas: {}, fundo: [] }; // sistema
let PIN = { status: "sem-config", imagens: [] }; // Pinterest (cache local)

async function api(p, body) {
  const r = await fetch(p, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("on");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 2600);
}
// Aberto pelo Tailscale (celular): apps embutidos pelos links do tailnet, montados a partir do host atual.
const remoto = location.hostname.endsWith(".ts.net");
const endereco = (s) => (remoto ? (s.tailnet ? `https://${location.hostname}:${s.tailnet}` : "") : s.proxy ? `http://127.0.0.1:${s.proxy}` : s.url);
const obs = (p) => `obsidian://open?vault=${encodeURIComponent(D.vault)}&file=${encodeURIComponent(p.replace(/\.md$/, ""))}`;
const nota = (p) => `#/n/${encodeURIComponent(p)}`;
const semLinks = (s) => s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a);
const comLinks = (s) => esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => `<a href="#/w/${encodeURIComponent(a)}">${b || a}</a>`);
const emLinks = (s) => esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => `<em>${b || a}</em>`); // trecho principal em itálico
const limpo = (s) => semLinks(s || "").replace(/[*`_]/g, "");
const nomeDe = (p) => p.split("/").pop().replace(/\.md$/, "");
const resolver = (nome) => D.notas.find((n) => nomeDe(n.path) === nome || n.titulo === nome);
function quando(ms) {
  const s = (ms - Date.now()) / 1000;
  for (const [u, n] of [["day", 86400], ["hour", 3600], ["minute", 60]]) if (Math.abs(s) >= n) return rel.format(Math.round(s / n), u);
  return "agora";
}
const duracao = (s) => (s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min` : `${Math.floor(s / 86400)} d`);
const vencidas = () => D.notas.filter((n) => n.revisar_em && n.revisar_em <= D.hoje).sort((a, b) => a.revisar_em.localeCompare(b.revisar_em));
const inbox = () => D.notas.filter((n) => n.pasta.startsWith("1 "));
const PASTAS = { "1": "Inbox", "2": "Diário", "3": "Conceitos", "4": "Ideias", "5": "Fontes", "6": "Projetos", "8": "Estudos" };
const titulo = (t, sub = "", extra = "") => `<div class="ph"><h1>${t}</h1>${sub ? `<p>${sub}</p>` : ""}${extra}</div>`;
const vazio = (t) => `<p class="empty">${t}</p>`;
const maiusc = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function precisa() { return (D.foco?.length || 0) + vencidas().length + inbox().length + (D.capturas?.length || 0); }

// ---------------------------------------------------------------- topo: navegação em texto
const NOME_APP = { grimoire: "Grimoire", tv: "TV" };
function telas() {
  return [["", "Home"], ["notas", "Notas"], ["revisar", "Revisar"], ["grafo", "Grafo"], ["agentes", "Agentes"], ["servicos", "Serviços"],
    ...S.servicos.filter((s) => s.dock).map((s) => [`s/${s.id}`, NOME_APP[s.id] || s.nome])];
}
function topo() {
  if (!D) return;
  const { pg, arg } = rota();
  const atual = pg === "s" ? `s/${arg}` : pg === "n" || pg === "w" ? "notas" : pg === "a" ? "agentes" : pg;
  $("#nav").innerHTML = telas().map(([id, nome]) => `<a href="#/${id}" class="${atual === id ? "on" : ""}" ${atual === id ? 'aria-current="page"' : ""}>${nome}</a>`).join("");
}
function relogio() { $("#hora").textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }

// ---------------------------------------------------------------- Home: carrossel do foco
function sugestoes() {
  const s = [];
  const ln = (txt) => txt.match(/\[\[([^\]|]+)/)?.[1];
  for (const f of D.foco || []) { const a = ln(f); s.push({ cat: "foco de hoje", origem: "da nota do dia", frase: emLinks(f), plano: semLinks(f), href: a ? `#/w/${encodeURIComponent(a)}` : obs(`2 Diário/${D.hoje}`), acao: "Abrir nota" }); }
  for (const n of vencidas()) s.push({ cat: "revisão", origem: n.revisar_em === D.hoje ? "vence hoje" : `vencida há ${dias(n.revisar_em, D.hoje)} d`, frase: `Revisar <em>${esc(n.titulo)}</em>`, plano: `Revisar ${n.titulo}`, href: "#/revisar", acao: "Revisar" });
  for (const c of D.capturas || []) s.push({ cat: "capturado hoje", origem: "da nota do dia", frase: `<em>${esc(semLinks(c))}</em>`, plano: semLinks(c), href: obs(`2 Diário/${D.hoje}`), acao: "Abrir no Obsidian" });
  for (const n of inbox()) s.push({ cat: "inbox", origem: `chegou ${quando(n.mtime)}`, frase: `Processar <em>${esc(n.titulo)}</em>`, plano: `Processar ${n.titulo}`, href: nota(n.path), acao: "Abrir nota" });
  for (const v of D.vermelhos.slice(0, 3)) s.push({ cat: "lacuna", origem: `citada ${v.n}×`, frase: `Escrever <em>${esc(v.alvo)}</em>`, plano: `Escrever ${v.alvo}`, href: `#/w/${encodeURIComponent(v.alvo)}`, acao: "Ver quem cita" });
  for (const n of D.notas.filter((n) => n.tipo === "projeto")) s.push({ cat: "projeto", origem: n.area || "projeto", frase: `<em>${esc(n.titulo)}</em>`, plano: n.titulo, href: nota(n.path), acao: "Abrir nota" });
  const fora = D.notas.filter((n) => n.tipo === "conceito" && !n.revisar_em).sort((a, b) => a.mtime - b.mtime).slice(0, 2);
  for (const n of fora) s.push({ cat: "redescobrir", origem: "fora do ciclo", frase: `Reler <em>${esc(n.titulo)}</em>`, plano: `Reler ${n.titulo}`, href: nota(n.path), acao: "Abrir nota" });
  return s.length ? s : [{ cat: "tudo em dia", origem: "", frase: "Nada pedindo atenção <em>agora</em>", plano: "Nada pendente", href: "#/notas", acao: "Ver notas" }];
}
// Imagem do slide: rotação determinística pela data; cada slide uma imagem diferente (enquanto houver imagens).
function imagem(i) {
  const im = PIN.imagens || [];
  return im.length ? im[(hash(D.hoje) + i) % im.length] : null;
}

let idx = 0, SG = [];
function home() {
  SG = sugestoes();
  idx = Math.min(idx, SG.length - 1);
  main.innerHTML = `<section class="car" id="car" aria-roledescription="carrossel" aria-label="Foco do dia"></section>
    <div class="dashes" id="dashes"></div>
    <section class="painel" id="painel"></section>`;
  slides(); painel();
}
function slides() {
  const n = SG.length, s = SG[idx], img = imagem(idx);
  const viz = (d, cls) => {
    if (n < 2) return "<div></div>";
    const j = (idx + d + n) % n, im = imagem(j);
    return `<div class="slide viz ${cls}" data-act="ir" data-i="${j}" aria-hidden="true">${im ? `<img src="/pin/${im.id}" alt="">` : ""}<div class="veu"></div>
      <div class="cont"><span></span><h2>${SG[j].frase}</h2></div></div>`;
  };
  $("#car").innerHTML = viz(-1, "ant") + `<article class="slide" aria-live="polite">
      ${img ? `<img src="/pin/${img.id}" alt="${esc(img.titulo || "Imagem da pasta do Pinterest")}"><div class="veu"></div>` : ""}
      <div class="cont">
        <div class="cima"><span>${esc(s.cat)} · ${idx + 1} de ${n}${s.origem ? ` · ${esc(s.origem)}` : ""}</span>
          ${img ? `<a class="fonte" href="${esc(img.link)}" target="_blank" rel="noopener">imagem · pinterest ↗</a>` : ""}</div>
        <div><h2>${s.frase}</h2>
          <div class="acoes"><a class="btn pri" href="${esc(s.href)}">${esc(s.acao)}</a>
            ${n > 1 ? `<button class="seta" data-act="prev" aria-label="Foco anterior (tecla ←)">←</button><button class="seta" data-act="next" aria-label="Próximo foco (tecla →)">→</button>
            <span class="depois">Depois: ${esc(SG[(idx + 1) % n].plano)}</span>` : ""}</div></div>
      </div></article>` + viz(1, "prox");
  $("#dashes").innerHTML = n > 1 ? SG.map((_, i) => `<button class="${i === idx ? "on" : ""}" data-act="ir" data-i="${i}" aria-label="Foco ${i + 1} de ${n}"></button>`).join("") : "";
}
const mover = (d) => { idx = (idx + d + SG.length) % SG.length; slides(); };
function painel() {
  const el = $("#painel");
  if (!el) return;
  const hoje = new Date(D.hoje + "T12:00");
  const rev = {};
  for (const n of D.notas) if (n.revisar_em) { const k = n.revisar_em < D.hoje ? D.hoje : n.revisar_em; rev[k] = (rev[k] || 0) + 1; }
  const semana = [...Array(6)].map((_, i) => {
    const d = somaDias(D.hoje, i + 1), dt = new Date(d + "T12:00");
    return `<a href="#/revisar" title="${rev[d] || 0} revisão(ões)"><span>${dt.toLocaleDateString("pt-BR", { weekday: "narrow" }).toUpperCase()}</span><b>${dt.getDate()}</b></a>`;
  }).join("");
  const n = precisa(), on = S.servicos.filter((s) => s.ok).length;
  const prox = D.notas.filter((x) => x.revisar_em > D.hoje).sort((a, b) => a.revisar_em.localeCompare(b.revisar_em))[0];
  el.innerHTML = `<div>
      <div class="dia"><span class="n">${hoje.getDate()}</span><span class="wk">${hoje.toLocaleDateString("pt-BR", { weekday: "long" })}<br>${hoje.toLocaleDateString("pt-BR", { month: "long" })}</span></div>
      <nav class="semana" aria-label="Próximos dias">${semana}</nav></div>
    <div>
      <div class="duas"><a href="#/revisar">Precisa de você <b class="hot">${n}</b></a><a href="#/agentes">Agentes rodando <b>${S.agentes.length}</b></a></div>
      <div class="tres">
        <a href="#/servicos"><span>Serviços</span><b>${on}/${S.servicos.length}</b><small>${esc(S.servicos.filter((s) => !s.ok).map((s) => s.nome).join(", ") || "todos no ar")}</small></a>
        <a href="#/revisar"><span>Revisão</span><b>${vencidas().length}</b><small>${prox ? `próxima ${rel.format(dias(D.hoje, prox.revisar_em), "day")}` : "nenhuma no ciclo"}</small></a>
        <a href="#/notas"><span>Vault</span><b>${D.notas.length}</b><small>${D.vermelhos.length} ${D.vermelhos.length === 1 ? "lacuna" : "lacunas"}</small></a>
      </div></div>`;
}

// ---------------------------------------------------------------- Notas
let filtro = "", busca = "";
function notas() {
  const cont = {};
  for (const n of D.notas) cont[n.pasta[0]] = (cont[n.pasta[0]] || 0) + 1;
  main.innerHTML = `<div class="col">${titulo("Notas", `${D.notas.length} notas no vault`,
      `<div class="r"><input class="search" id="busca" placeholder="Buscar título ou resumo  /" value="${esc(busca)}" autocomplete="off" aria-label="Buscar notas (atalho /)"></div>`)}
    <div class="tabs" role="tablist">${[["", "Todas", D.notas.length], ...Object.entries(PASTAS).filter(([k]) => cont[k]).map(([k, v]) => [k, v, cont[k]])]
      .map(([k, v, c]) => `<button class="tab ${filtro === k ? "on" : ""}" role="tab" aria-selected="${filtro === k}" data-act="filtro" data-k="${k}">${v}<small>${c}</small></button>`).join("")}</div>
    <div class="rows" id="ngrid"></div></div>`;
  grade();
}
const linhaNota = (n) => `<a class="row" href="${nota(n.path)}">
    <span class="t"><b>${esc(n.titulo)}</b><span>${esc(n.tipo === "diario" ? "Nota do dia" : limpo(n.resumo) || "Sem resumo de uma frase")}</span></span>
    ${n.tipo ? `<span class="tag">${esc(n.tipo)}</span>` : ""}<span class="x">${quando(n.mtime)}</span></a>`;
function grade() {
  const q = fold(busca);
  const peso = (n) => (!q ? 0 : fold(n.titulo).startsWith(q) ? 0 : fold(n.titulo).includes(q) ? 1 : 2);
  const ns = D.notas.filter((n) => (!filtro || n.pasta[0] === filtro) && (!q || fold(n.titulo + " " + n.resumo + " " + n.tags.join(" ")).includes(q)))
    .sort((a, b) => peso(a) - peso(b) || b.mtime - a.mtime);
  $("#ngrid").innerHTML = ns.map(linhaNota).join("") || vazio(`Nada com "${esc(busca)}".`);
}

// ---------------------------------------------------------------- Leitor
async function leitor(path) {
  const n = await api(`/api/nota?path=${encodeURIComponent(path)}`).catch(() => null);
  if (!n) { main.innerHTML = vazio("Nota não encontrada."); return; }
  const ciclo = n.revisar_em ? `No ciclo: revisa ${n.revisar_em <= D.hoje ? "hoje" : rel.format(dias(D.hoje, n.revisar_em), "day")}, intervalo ${n.intervalo} d` : "";
  main.innerHTML = `<article class="reader">${titulo(esc(n.titulo))}
      <div class="meta">${[n.tipo, n.area, ...n.tags].filter(Boolean).map(esc).join("<span>·</span>")}</div>
      <div class="prose" id="prose">${n.html}</div>
      <div class="reader-acts"><a class="btn pri" href="${obs(n.path)}">Abrir no Obsidian ↗</a>
        ${ciclo ? `<span class="empty">${ciclo}</span>` : `<button class="btn" data-act="entrar" data-p="${esc(n.path)}">Colocar no ciclo</button>`}</div>
      <p class="label">Citada por</p><div class="rows">${n.backlinks.map((b) => `<a class="row" href="${nota(b.path)}"><span class="t"><b>${esc(b.titulo)}</b></span></a>`).join("") || vazio("Ninguém cita ainda.")}</div>
      <p class="label">Cita</p><div class="rows">${[...new Set(n.links)].map((l) => `<a class="row" href="#/w/${encodeURIComponent(l)}"><span class="t"><b style="${resolver(l) ? "" : "color:var(--muted)"}">${esc(l)}</b></span>${resolver(l) ? "" : '<span class="tag">lacuna</span>'}</a>`).join("") || vazio("Nenhum link.")}</div>
    </article>`;
  // Callout do Obsidian: blockquote que começa com [!tipo] Título.
  document.querySelectorAll("#prose blockquote").forEach((b) => {
    const p = b.querySelector("p");
    const m = p?.innerHTML.match(/^\[!(\w+)\]\s*([^\n<]*)(?:<br\s*\/?>|\n)?/);
    if (!m) return;
    p.innerHTML = `<span class="ct">${m[2] || m[1]}</span>` + p.innerHTML.slice(m[0].length);
  });
  scrollTo({ top: 0 });
}
function wiki(nome) {
  const n = resolver(nome);
  if (n) return location.replace(nota(n.path));
  const quem = D.notas.filter((x) => x.links.includes(nome));
  main.innerHTML = `<div class="col">${titulo(esc(nome), "Lacuna: ainda não existe. Link vermelho é backlog honesto, não erro.")}
    <p class="label">Citada por</p><div class="rows">${quem.map(linhaNota).join("") || vazio("Ninguém.")}</div>
    <p class="empty">Para escrever: peça ao agente "escreve a nota ${esc(nome)}" ou crie no Obsidian. Não clique no link vermelho só para criar arquivo vazio.</p></div>`;
}

// ---------------------------------------------------------------- Revisar
let fila = [], pos = 0, aberta = false, feitas = 0;
function revisar() {
  fila = vencidas(); pos = 0; aberta = false; feitas = 0;
  cartao();
}
function cartao() {
  const n = fila[pos];
  if (!n) {
    const prox = D.notas.filter((x) => x.revisar_em > D.hoje).sort((a, b) => a.revisar_em.localeCompare(b.revisar_em));
    const fora = D.notas.filter((x) => !x.revisar_em && x.resumo && x.tipo !== "diario").sort((a, b) => b.mtime - a.mtime).slice(0, 8);
    main.innerHTML = `<div class="col">${titulo(feitas ? `${feitas} revisada${feitas > 1 ? "s" : ""}. Feito.` : "Nada vencido hoje", "Lembrou dobra o intervalo; esqueceu volta para 1 dia.")}
      <p class="label">Próximas</p><div class="rows">${prox.slice(0, 8).map((x) => `<a class="row" href="${nota(x.path)}"><span class="t"><b>${esc(x.titulo)}</b></span><span class="x mono">${x.revisar_em} · ${x.intervalo} d</span></a>`).join("") || vazio("Nenhuma nota no ciclo ainda.")}</div>
      <p class="label">Colocar no ciclo</p><div class="rows">${fora.map((x) => `<div class="row"><a class="t" href="${nota(x.path)}"><b>${esc(x.titulo)}</b><span>${esc(limpo(x.resumo))}</span></a>
        <button class="btn sm" data-act="entrar" data-p="${esc(x.path)}">Entrar</button></div>`).join("") || vazio("Todas já estão.")}</div></div>`;
    return;
  }
  main.innerHTML = `<section class="flash">
      <span class="n">${pos + 1} de ${fila.length} · ${esc(n.pasta)}</span>
      <h1>${esc(n.titulo)}</h1>
      ${aberta ? `<p class="ans">${esc(limpo(n.resumo) || "Sem resumo de uma frase. Abra a nota.")}</p>
        <div class="acts"><button class="btn" data-act="nao">Não lembrei <kbd>1</kbd></button><button class="btn pri" data-act="sim">Lembrei <kbd>2</kbd></button><a class="btn" href="${nota(n.path)}">Ler a nota</a></div>`
      : `<div class="acts"><button class="btn pri" data-act="mostrar">Mostrar resposta <kbd>espaço</kbd></button></div>`}
    </section>`;
}
async function responder(lembrou) {
  const n = fila[pos];
  const r = await api("/api/revisar", { path: n.path, lembrou });
  toast(`${n.titulo}: volta em ${r.intervalo} d`);
  pos++; aberta = false; feitas++;
  D = await api("/api"); topo(); cartao();
}

// ---------------------------------------------------------------- Grafo
let grafoStop = null, grafoFiltro = "";
function grafo() {
  main.innerHTML = `${titulo("Grafo", "Clique abre a nota. Arraste para mover, roda do mouse dá zoom.")}
    <section class="graph"><canvas id="cv" aria-label="Grafo de links entre notas"></canvas><div class="legend" id="leg"></div></section>`;
  const cv = $("#cv"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  const tok = getComputedStyle(document.documentElement);
  const C = { muted: tok.getPropertyValue("--muted").trim(), text: tok.getPropertyValue("--text").trim(), line: tok.getPropertyValue("--line").trim(), forte: tok.getPropertyValue("--label").trim() };
  const cores = { programacao: "#b39a86", cc: "#8a9fae", ia: "#a294b3", matematica: "#8fa898" }; // dessaturadas: só anel e legenda
  const nodes = D.notas.filter((n) => n.tipo !== "diario").map((n) => ({ id: nomeDe(n.path), t: n.titulo, p: n.path, area: n.area }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const v of D.vermelhos) if (!byId.has(v.alvo)) { const g = { id: v.alvo, t: v.alvo, ghost: true }; nodes.push(g); byId.set(v.alvo, g); }
  const edges = [];
  for (const n of D.notas) for (const l of new Set(n.links)) { const a = byId.get(nomeDe(n.path)), b = byId.get(l); if (a && b && a !== b) edges.push([a, b]); }
  const deg = new Map();
  for (const [a, b] of edges) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
  let W, H;
  const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; };
  size();
  nodes.forEach((n, i) => { const a = i * 2.4; n.x = W / 2 + Math.cos(a) * (60 + i * 6); n.y = H / 2 + Math.sin(a) * (60 + i * 6); n.vx = n.vy = 0; n.r = 3 + Math.sqrt(deg.get(n) || 0) * 2; });
  let hover = null, drag = null, pan = null, calor = 1;
  const view = { k: 1, x: 0, y: 0, manual: false }; // tela = mundo * k + (x, y)
  // Enquadra o grafo na tela enquanto ele assenta; para de mexer quando você dá zoom ou arrasta o fundo.
  const enquadrar = () => {
    if (view.manual || !nodes.length) return;
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    view.k = Math.min(1.5, (W - 160) / (x1 - x0 || 1), (H - 140) / (y1 - y0 || 1));
    view.x = W / 2 - ((x0 + x1) / 2) * view.k; view.y = H / 2 - ((y0 + y1) / 2) * view.k;
  };
  const mundo = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - view.x) / view.k, (e.clientY - r.top - view.y) / view.k]; };
  // ponytail: repulsão O(n²); ok até ~500 notas, quadtree se o vault crescer.
  function passo() {
    for (const a of nodes) for (const b of nodes) {
      if (a === b) continue;
      const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01, f = 2400 / d2;
      a.vx += dx * f * 0.05; a.vy += dy * f * 0.05;
    }
    for (const [a, b] of edges) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - 120) * 0.004;
      a.vx += dx / d * f * d * 0.1; a.vy += dy / d * f * d * 0.1; b.vx -= dx / d * f * d * 0.1; b.vy -= dy / d * f * d * 0.1;
    }
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.002; n.vy += (H / 2 - n.y) * 0.002;
      if (n !== drag) { n.x += n.vx * calor; n.y += n.vy * calor; }
      n.vx *= 0.6; n.vy *= 0.6;
    }
    calor = Math.max(0.05, calor * 0.99);
  }
  const visivel = (n) => !grafoFiltro || n.area === grafoFiltro;
  function desenhar() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.x, dpr * view.y);
    const viz = hover ? new Set(edges.filter(([a, b]) => a === hover || b === hover).flat()) : null;
    ctx.lineWidth = 1 / view.k;
    for (const [a, b] of edges) {
      if (!visivel(a) && !visivel(b)) continue;
      ctx.strokeStyle = viz && (a === hover || b === hover) ? C.forte : C.line;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.font = `400 ${12 / view.k}px Geist, sans-serif`;
    for (const n of nodes) {
      const foco = n === hover || viz?.has(n);
      ctx.globalAlpha = !visivel(n) ? 0.15 : viz && !foco ? 0.35 : 1;
      ctx.fillStyle = foco ? C.text : C.muted;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
      if (cores[n.area]) { ctx.strokeStyle = cores[n.area]; ctx.lineWidth = 1.5 / view.k; ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 2.5 / view.k, 0, 7); ctx.stroke(); ctx.lineWidth = 1 / view.k; }
      if (foco || (view.k > 1.6 && visivel(n))) { // rótulo só no hover ou com zoom: para de sobrepor
        ctx.fillStyle = n === hover ? C.text : C.muted;
        ctx.fillText(n.ghost ? `${n.t} (lacuna)` : n.t, n.x + n.r + 6 / view.k, n.y + 4 / view.k);
      }
    }
    ctx.globalAlpha = 1;
  }
  let vivo = true, parado = false;
  // Para quando assenta: só volta a animar com interação (economiza CPU parado na aba).
  const loop = () => { if (!vivo) return; passo(); enquadrar(); desenhar(); if (calor > 0.06 || drag) requestAnimationFrame(loop); else parado = true; };
  const acordar = () => { if (parado && vivo) { parado = false; requestAnimationFrame(loop); } };
  loop();
  grafoStop = () => { vivo = false; };
  const achar = (e) => { const [x, y] = mundo(e); return nodes.find((n) => Math.hypot(n.x - x, n.y - y) < n.r + 5 / view.k); };
  let moveu = false;
  cv.onpointermove = (e) => {
    if (drag) { [drag.x, drag.y] = mundo(e); moveu = true; calor = Math.max(calor, 0.3); acordar(); }
    else if (pan) { view.x = pan.vx + e.clientX - pan.x; view.y = pan.vy + e.clientY - pan.y; moveu = view.manual = true; desenhar(); }
    else { const h = achar(e); if (h !== hover) { hover = h; desenhar(); } cv.style.cursor = hover ? "pointer" : "grab"; }
  };
  cv.onpointerdown = (e) => { drag = achar(e); moveu = false; if (!drag) pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; };
  cv.onpointerup = () => { if (drag && !moveu) location.hash = drag.ghost ? `#/w/${encodeURIComponent(drag.id)}` : nota(drag.p); drag = null; pan = null; };
  cv.onwheel = (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.min(4, Math.max(0.4, view.k * Math.exp(-e.deltaY * 0.0015)));
    view.x = mx - (mx - view.x) * (k / view.k); view.y = my - (my - view.y) * (k / view.k); view.k = k; view.manual = true;
    desenhar();
  };
  const leg = () => {
    $("#leg").innerHTML = `<button class="${grafoFiltro ? "" : "on"}" data-act="gfiltro" data-k="">Todas</button>` +
      Object.entries(cores).map(([k, c]) => `<button class="${grafoFiltro === k ? "on" : ""}" data-act="gfiltro" data-k="${k}"><i style="border-color:${c}"></i>${k}</button>`).join("");
  };
  ACOES.gfiltro = (el) => { grafoFiltro = el.dataset.k; leg(); desenhar(); };
  leg();
}

// ---------------------------------------------------------------- Agentes
const ROT = {
  "bom-dia": ["Bom dia", "Monta o foco de hoje na nota do dia: revisões, prova próxima, inbox, lacunas."],
  inbox: ["Inbox", "Processa 1 Inbox/: cada item vira nota no padrão ou fica, com o motivo."],
};
const NOME_AG = { claude: "Claude Code", agy: "Antigravity", codex: "Codex", gemini: "Gemini" };
const ESTADO = { blocked: "esperando você", working: "trabalhando", running: "trabalhando", done: "terminou", idle: "parado" };
function agentes() {
  main.innerHTML = `<div class="col">${titulo("Agentes", "Claude e AGY seguem o mesmo AGENTS.md. Rotina roda no AGY.")}
    <p class="label">Rodando agora</p><div class="rows">${S.agentes.map((a) => `<a class="row" href="#/a/${a.chave}"><span class="dot"></span>
        <span class="t"><b>${NOME_AG[a.nome] || a.nome}</b><span class="mono">${esc(a.cwd)}</span></span>
        <span class="x mono">pid ${a.pid}</span><span class="x">há ${duracao(a.segundos)}</span><span class="link">Ver ao vivo →</span></a>`).join("") || vazio("Nenhum agente rodando.")}</div>
    ${S.fundo?.length ? `<p class="label">Em segundo plano</p><div class="rows">${S.fundo.map((f) => `<a class="row" href="#/a/${f.chave}">
        <span class="dot ${f.estado === "blocked" ? "run" : f.estado === "done" ? "idle" : ""}"></span>
        <span class="t"><b>${esc(f.titulo)}</b><span>${esc(f.precisa || f.cwd)}</span></span>
        <span class="x" style="${f.estado === "blocked" ? "color:var(--accent)" : ""}">${ESTADO[f.estado] || f.estado}</span><span class="x">${quando(f.desde)}</span></a>`).join("")}</div>` : ""}
    <p class="label">Rotinas</p><div class="rows">${Object.entries(ROT).map(([k, [nome, desc]]) => {
      const r = S.rotinas[k];
      const st = !r ? "nunca rodou nesta sessão" : !r.fim ? `rodando desde ${r.inicio.slice(11)}` : `${r.ok ? "terminou" : "falhou"} às ${r.fim.slice(11)}`;
      const vivo = r && !r.fim && S.agentes.find((x) => x.pid === r.pid)?.chave;
      return `<div class="row"><span class="dot ${!r ? "idle" : !r.fim ? "run" : r.ok ? "" : "off"}"></span>
        <span class="t"><b>${nome}</b><span>${desc}</span></span><span class="x">${st}</span>${vivo ? `<a class="link" href="#/a/${vivo}">Ver ao vivo</a>` : ""}
        <button class="btn" data-act="rotina" data-k="${k}" ${r && !r.fim ? "disabled" : ""}>Rodar no AGY</button></div>`;
    }).join("")}</div>
    <p class="label">Log</p><div class="rows">${D.log.map((l) => {
      const [q, quem, ...resto] = l.split(" · ");
      return `<div class="row"><span class="x mono">${esc(q.slice(5).replace("-", "/"))}</span><span class="who">${esc(quem)}</span><span class="msg">${comLinks(resto.join(" · "))}</span></div>`;
    }).join("") || vazio("Nenhuma execução registrada.")}</div>
    <p class="label">Achados</p><div class="rows">${D.achados.map((a) => { const [d, ...t] = a.split(" · "); return `<div class="row"><span class="x mono">${esc(d)}</span><span class="msg">${esc(t.join(" · "))}</span></div>`; }).join("")}</div></div>`;
}

// ---------------------------------------------------------------- Agente ao vivo
// Lê a conversa no disco (Claude: .jsonl da sessão; AGY: SQLite) a cada 3 s, só com a página aberta.
// A caixa de mensagem é desenhada uma vez; só cabeçalho e feed se atualizam, para não apagar o que você digita.
const QUEM = { voce: "você", resultado: "resultado" };
// Markdown mínimo (negrito, código, título) aplicado DEPOIS de escapar: texto da conversa nunca vira HTML.
const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/^#{1,4} (.+)$/gm, "<b>$1</b>");
let agTimer = null, agUltimo = "";
async function agentePg(chave) {
  clearInterval(agTimer); agUltimo = "";
  main.innerHTML = `<div class="col"><div id="aghead"></div><div id="agprecisa"></div><div class="rows feed" id="feed"><p class="empty">Lendo a conversa…</p></div>
    <form class="falar" id="falar"><textarea id="msg" rows="2" placeholder="Mandar mensagem. Enter envia, Shift+Enter quebra linha" aria-label="Mensagem para o agente"></textarea>
      <button class="btn pri" type="submit">Enviar</button><small id="falardica"></small></form></div>`;
  const desenha = async () => {
    if (rota().pg !== "a" || rota().arg !== chave) return clearInterval(agTimer);
    const a = await api(`/api/agente?chave=${encodeURIComponent(chave)}`).catch(() => null);
    if (!a) { main.innerHTML = `<div class="col">${titulo("Conversa não encontrada")}<a class="btn" href="#/agentes">Voltar para Agentes</a></div>`; return clearInterval(agTimer); }
    const assinatura = a.vivo + a.estado + a.eventos.length + (a.eventos.at(-1)?.txt || "");
    if (assinatura === agUltimo) return;
    agUltimo = assinatura;
    const status = a.vivo ? "rodando" : ESTADO[a.estado] || "parado";
    $("#aghead").innerHTML = titulo(esc(a.titulo || NOME_AG[a.nome] || a.nome),
      `${esc(NOME_AG[a.nome] || a.nome)} · <span class="mono">${esc(a.cwd)}</span>${a.pid ? ` · pid ${a.pid}` : ""}${a.segundos ? ` · há ${duracao(a.segundos)}` : ""} · ${status}`);
    $("#agprecisa").innerHTML = a.precisa ? `<div class="precisa"><p class="label" style="margin:0 0 6px">Precisa de você</p><p>${fmt(a.precisa)}</p></div>` : "";
    $("#falardica").textContent = a.nome === "agy" ? "Continua esta conversa no AGY (agy -p --conversation)."
      : a.vivo ? "Sessão aberta num terminal: a resposta vem numa cópia em segundo plano, e o terminal fica intacto."
      : "Continua esta sessão em segundo plano (claude --bg --resume).";
    const noFim = innerHeight + scrollY >= document.body.scrollHeight - 160;
    $("#feed").innerHTML = a.eventos.map((e) => `<div class="row ev ${e.t}">
        <span class="x mono">${e.quando ? new Date(e.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
        <span class="who">${esc(QUEM[e.t] ?? (e.t === "ferramenta" ? e.nome : a.nome))}</span>
        <span class="msg">${e.t === "texto" || e.t === "voce" ? fmt(e.txt) : esc(e.txt)}</span></div>`).join("") || vazio("Nada para mostrar ainda.");
    if (noFim) scrollTo({ top: document.body.scrollHeight });
  };
  const enviar = async () => {
    const t = $("#msg"), texto = t.value.trim();
    if (!texto || t.disabled) return;
    t.disabled = true;
    try {
      const r = await api("/api/falar", { chave, texto });
      t.value = ""; toast("Mensagem enviada");
      if (r.chave !== chave) { location.hash = `#/a/${r.chave}`; return; } // Claude abriu uma cópia em segundo plano: segue nela
      agUltimo = ""; setTimeout(desenha, 1500);
    } catch (e) { toast(`Não enviou: ${e.message}`); } finally { t.disabled = false; t.focus(); }
  };
  $("#falar").onsubmit = (e) => { e.preventDefault(); enviar(); };
  $("#msg").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } };
  await desenha();
  agTimer = setInterval(desenha, 3000);
}

// ---------------------------------------------------------------- Serviços
const STATUS_PIN = { ok: "sincronizado", "sem-config": "falta configurar (README › Pinterest)", desconectado: "reconectar Pinterest", erro: "erro" };
function linhaPinterest(s) {
  const p = s.pinterest || PIN;
  const aviso = p.status === "desconectado" ? `<a class="link" href="/auth/pinterest">Reconectar Pinterest</a>`
    : p.status === "sem-config" ? `<a class="link" href="/auth/pinterest">Conectar</a>` : "";
  return `<div class="row"><span class="dot ${p.status === "ok" ? "" : p.status === "erro" ? "off" : "idle"}"></span>
    <span class="t"><b>${esc(s.nome)}</b><span>${esc(p.status === "erro" ? p.erro : p.status === "ok" ? s.desc : STATUS_PIN[p.status])}</span></span>
    <span class="x mono">${p.total ?? 0} imagens${p.ultima ? ` · ${new Date(p.ultima).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}</span>
    ${aviso}<button class="btn" data-act="pinsync" ${p.sincronizando || p.status === "sem-config" ? "disabled" : ""}>${p.sincronizando ? "Sincronizando…" : "Sincronizar agora"}</button></div>`;
}
function servicos() {
  main.innerHTML = `<div class="col">${titulo("Serviços", "Os localhost da máquina e o Pinterest. Lista em servicos.json.")}
    <div class="rows">${S.servicos.map((s) => s.interno === "pinterest" ? linhaPinterest(s) : `<div class="row"><span class="dot ${s.ok ? "" : "off"}"></span>
        <span class="t"><b>${esc(s.nome)}</b><span>${esc(s.desc)}</span></span>
        <span class="x mono">${esc(new URL(remoto && endereco(s) ? endereco(s) : s.url).host)} · ${s.ok ? `${s.ms} ms` : "fora do ar"}</span>
        ${s.ok && endereco(s) ? `<a class="btn" href="#/s/${esc(s.id)}">Ver aqui</a>` : ""}
        <a class="link" href="${esc(remoto ? endereco(s) || "#/servicos" : s.url)}" target="_blank" rel="noopener">Abrir ↗</a></div>`).join("")}</div></div>`;
}

// ---------------------------------------------------------------- Serviço embutido
function servico(id) {
  const s = S.servicos.find((x) => x.id === id);
  if (!s || s.interno) { main.innerHTML = vazio("Serviço não encontrado em servicos.json."); return; }
  const src = endereco(s), aba = remoto ? src : s.url;
  $("#svcbar").innerHTML = `<span class="dot ${s.ok ? "" : "off"}"></span><span class="mono">${esc(new URL(remoto && src ? src : s.url).host)}${s.ok ? ` · ${s.ms} ms` : " · fora do ar"}</span>
    <button class="link" data-act="recarregar">Recarregar</button><a class="link" href="${esc(aba)}" target="_blank" rel="noopener">Abrir ↗</a>`;
  main.innerHTML = `<div class="frame" style="${s.max ? `max-width:${s.max}px;margin:0 auto` : ""}">
      ${!src ? vazio(`${esc(s.nome)} não está publicado no Tailscale (campo "tailnet" em servicos.json).`)
        : s.ok ? `<iframe id="svcf" src="${esc(src)}" title="${esc(s.nome)}"></iframe>` : vazio(`${esc(s.nome)} está fora do ar.`)}</div>`;
}

// ---------------------------------------------------------------- rotas e eventos
const PAGINAS = { "": home, notas, n: leitor, w: wiki, revisar, grafo, agentes, servicos, s: servico, a: agentePg };
function rota() { const [, pg = "", ...r] = location.hash.split("/"); return { pg: PAGINAS[pg] ? pg : "", arg: decodeURIComponent(r.join("/")) }; }
function render() {
  if (!D) return;
  grafoStop?.(); grafoStop = null;
  const { pg, arg } = rota();
  document.body.classList.toggle("app", pg === "s");
  if (pg !== "s") $("#svcbar").innerHTML = "";
  main.style.animation = "none"; main.offsetHeight; main.style.animation = "";
  topo();
  PAGINAS[pg](arg);
}

const ACOES = {
  next: () => mover(1), prev: () => mover(-1), ir: (el) => { idx = Number(el.dataset.i); slides(); },
  filtro: (el) => { filtro = el.dataset.k; notas(); },
  mostrar: () => { aberta = true; cartao(); }, sim: () => responder(true), nao: () => responder(false),
  entrar: async (el) => { await api("/api/revisar", { path: el.dataset.p, lembrou: false }); toast("No ciclo: primeira revisão amanhã"); D = await api("/api"); render(); },
  rotina: async (el) => {
    try { await api("/api/rotina", { nome: el.dataset.k }); toast("Rotina disparada no AGY"); } catch (e) { toast(e.message); }
    S = await api("/api/sistema"); agentes(); topo();
  },
  pinsync: async (el) => {
    el.disabled = true; el.textContent = "Sincronizando…";
    PIN = await api("/api/pinterest/sync", {}).catch(() => PIN);
    toast(PIN.status === "ok" ? `${PIN.imagens.length} imagens no cache` : PIN.erro || STATUS_PIN[PIN.status]);
    S = await api("/api/sistema"); servicos();
  },
  recarregar: () => { const f = $("#svcf"); f.src = f.src; },
  capturar: () => { $("#capdia").textContent = D.hoje; $("#cap").showModal(); $("#capt").focus(); },
};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (el) { e.preventDefault(); ACOES[el.dataset.act]?.(el); }
});
document.addEventListener("input", (e) => { if (e.target.id === "busca") { busca = e.target.value; grade(); } });
$("#capt").addEventListener("keydown", async (e) => {
  if (e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  const texto = e.target.value.trim();
  if (!texto) return;
  await api("/api/capturar", { texto });
  e.target.value = ""; $("#cap").close(); toast("Capturado na nota do dia");
  D = await api("/api"); if (!rota().pg) home(); topo();
});
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea") || document.querySelector("dialog[open]") || e.ctrlKey || e.metaKey || e.altKey) return;
  const { pg } = rota();
  const cartaoAberto = pg === "revisar" && fila[pos];
  if (e.key === "c") { e.preventDefault(); ACOES.capturar(); return; }
  if (e.key === "/" && pg === "notas") { e.preventDefault(); $("#busca").focus(); return; }
  if (!pg && e.key === "ArrowRight") return mover(1);
  if (!pg && e.key === "ArrowLeft") return mover(-1);
  if (cartaoAberto) {
    if (e.key === " " && !aberta) { e.preventDefault(); return ACOES.mostrar(); }
    if (aberta && e.key === "1") return responder(false);
    if (aberta && e.key === "2") return responder(true);
  }
  const t = telas()[Number(e.key) - 1]; // 1–8 navega entre as telas
  if (/^[1-9]$/.test(e.key) && t) location.hash = `#/${t[0]}`;
});

addEventListener("hashchange", render);
async function vault() { D = await api("/api"); }
async function sistema() { S = await api("/api/sistema"); }
async function pinterest() { PIN = await api("/api/pinterest").catch(() => PIN); }
// Sistema a cada 10 s (agentes, serviços), vault ao voltar para a aba e a cada minuto.
setInterval(async () => {
  await sistema(); topo();
  const { pg } = rota();
  if (!pg) painel(); else if (pg === "agentes" || pg === "servicos") PAGINAS[pg]();
}, 10000);
setInterval(async () => { await Promise.all([vault(), pinterest()]); topo(); if (!rota().pg) painel(); }, 60000);
addEventListener("focus", async () => { await vault(); topo(); const { pg } = rota(); if (!pg) { SG = sugestoes(); idx = Math.min(idx, SG.length - 1); slides(); painel(); } else if (pg === "notas") grade(); });
setInterval(relogio, 1000);
relogio();
Promise.all([vault(), sistema(), pinterest()]).then(render);

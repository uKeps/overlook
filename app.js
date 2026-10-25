// Vault HQ. Rotas por hash, dados de /api (vault) e /api/sistema (agentes, serviços, rotinas).
const $ = (s, el = document) => el.querySelector(s);
const main = $("#main");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const rel = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const somaDias = (d, n) => new Date(new Date(d + "T12:00").getTime() + n * 864e5).toLocaleDateString("sv");

let D = null; // vault
let S = { agentes: [], servicos: [], rotinas: {} }; // sistema

const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  notas: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  revisar: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  grafo: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8.4 6.6l7.2 1M7 8.3l2.2 7.3M16.6 10.1l-5 6"/>',
  agentes: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13v1.5M15 13v1.5"/>',
  servicos: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  spark: '<path d="M12 3l1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9z"/>',
  l: '<path d="m15 18-6-6 6-6"/>', r: '<path d="m9 18 6-6-6-6"/>', ext: '<path d="M7 17 17 7M9 7h8v8"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  livro: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
  tv: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>',
  reload: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>', play: '<path d="m7 4 13 8-13 8z"/>',
  alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  lacuna: '<path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 4 8M8 12h4"/><path d="m3 3 18 18"/>',
  folha: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z"/><path d="M2 21c0-3 1.9-5.4 5-6"/>',
};
const icon = (n, s = 20) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

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
const pinObj = (s) => (D?.pins?.length ? D.pins[(typeof s === "number" ? hash(D.hoje) + s : hash(String(s))) % D.pins.length] : null);
const arte = (s) => (pinObj(s) ? `/pin/${pinObj(s).id}` : D?.arte ? `/arte/${hash(String(s)) % D.arte}` : "");
const obs = (p) => `obsidian://open?vault=${encodeURIComponent(D.vault)}&file=${encodeURIComponent(p.replace(/\.md$/, ""))}`;
const nota = (p) => `#/n/${encodeURIComponent(p)}`;
const semLinks = (s) => s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a);
const emLinks = (s) => esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => `<em>${b || a}</em>`);
const comLinks = (s) => esc(s).replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => `<a href="#/w/${encodeURIComponent(a)}">${b || a}</a>`);
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

// Fundo ambiente: duas camadas em crossfade com a arte do que está em foco.
let ambAtual = "", ambA = false;
function ambiente(url) {
  if (!url || url === ambAtual) return;
  ambAtual = url; ambA = !ambA;
  const [on, off] = ambA ? [$("#amb1"), $("#amb2")] : [$("#amb2"), $("#amb1")];
  on.style.backgroundImage = `url(${url}?amb)`; on.classList.add("on"); off.classList.remove("on");
}

// ---------------------------------------------------------------- topo, semana, dock
function relogio() {
  const d = new Date();
  $("#hora").textContent = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  $("#data").textContent = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}
function precisa() { return (D.foco?.length || 0) + vencidas().length + inbox().length + (D.capturas?.length || 0); }
function rodandoAgora() { return Object.values(S.rotinas).filter((r) => !r.fim).length; }

function topo() {
  if (!D) return;
  const rev = {};
  for (const n of D.notas) if (n.revisar_em) { const k = n.revisar_em < D.hoje ? D.hoje : n.revisar_em; rev[k] = (rev[k] || 0) + 1; }
  const diarias = new Set(D.diarias);
  const semana = [...Array(7)].map((_, i) => {
    const d = somaDias(D.hoje, i), dt = new Date(d + "T12:00");
    const nr = rev[d] || 0;
    const dots = [...Array(Math.min(nr, 3))].map(() => "<i></i>").join("") + (diarias.has(d) ? '<i class="d"></i>' : "");
    return `<a class="day ${i ? "" : "hoje"}" href="#/revisar" title="${nr} revisão(ões)${diarias.has(d) ? " · nota do dia" : ""}">
      <span>${dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span><b>${dt.getDate()}</b><span class="m">${dots}</span></a>`;
  }).join("");
  const n = precisa(), rod = rodandoAgora(), vivos = S.agentes.length;
  $("#week").innerHTML = `${semana}<span class="wk-sep"></span>
    <a class="chipbox" href="#/revisar">${icon("alvo", 18)}<span><b>Precisa de você</b>${n} ${n === 1 ? "item" : "itens"}</span></a>
    <a class="chipbox" href="#/agentes">${icon("bolt", 18)}<span><b>Agentes</b>${vivos} ativos${rod ? ` · ${rod} rotina` : ""}</span></a>`;

  const { pg } = rota();
  const { arg } = rota();
  const item = (id, nome, ic, badge = 0) => `<a href="#/${id}" class="${pg === id || (id === "" && !pg) || (pg === "s" && id === `s/${arg}`) ? "on" : ""}" data-tip="${nome}" aria-label="${nome}">${icon(ic, 22)}${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
  $("#dock").innerHTML = item("", "Home", "home") + '<span class="sep"></span>' +
    item("notas", "Notas", "notas") + item("revisar", "Revisar", "revisar", vencidas().length) + item("grafo", "Grafo", "grafo") +
    item("agentes", "Agentes", "agentes", rod) + item("servicos", "Serviços", "servicos", S.servicos.filter((s) => !s.ok).length) +
    (S.servicos.some((s) => s.dock) ? '<span class="sep app"></span>' + S.servicos.filter((s) => s.dock).map((s) => item(`s/${s.id}`, s.nome, s.icone || "servicos").replace("<a ", '<a data-app ')).join("") : "") +
    `<span class="sep"></span><button class="spark" data-act="capturar" data-tip="Capturar (C)" aria-label="Capturar">${icon("spark", 22)}</button>`;
}

// ---------------------------------------------------------------- Home: carrossel de sugestões
function sugestoes() {
  const s = [];
  const ln = (txt) => txt.match(/\[\[([^\]|]+)/)?.[1];
  for (const f of D.foco || []) { const a = ln(f); s.push({ cat: "Foco de hoje", ic: "alvo", titulo: semLinks(f), raw: f, sub: "Escolhido para hoje na nota do dia.", meta: [["Origem", "Nota do dia"]], href: a ? `#/w/${encodeURIComponent(a)}` : obs(`2 Diário/${D.hoje}`), acao: "Abrir" }); }
  for (const n of vencidas()) s.push({ cat: "Revisão", ic: "revisar", titulo: n.titulo, sub: "Antes de abrir: você lembra do que se trata?", meta: [["Vencida", n.revisar_em === D.hoje ? "hoje" : `há ${dias(n.revisar_em, D.hoje)} d`], ["Intervalo", `${n.intervalo} d`]], href: "#/revisar", acao: "Revisar" });
  for (const c of D.capturas || []) s.push({ cat: "Capturado hoje", ic: "spark", titulo: semLinks(c), raw: c, sub: "Captura crua. Vira nota quando couber numa frase, ou morre.", meta: [["Status", "Na nota do dia"]], href: obs(`2 Diário/${D.hoje}`), acao: "Abrir no Obsidian" });
  for (const n of inbox()) s.push({ cat: "Inbox", ic: "inbox", titulo: n.titulo, sub: "Processar: vira nota permanente ou sai do vault.", meta: [["Chegou", quando(n.mtime)]], href: nota(n.path), acao: "Abrir" });
  for (const v of D.vermelhos.slice(0, 3)) s.push({ cat: "Lacuna", ic: "lacuna", titulo: v.alvo, sub: `Citado ${v.n}× e ainda não existe. Escreva quando precisar, não por obrigação.`, meta: [["Citado", `${v.n}×`]], href: `#/w/${encodeURIComponent(v.alvo)}`, acao: "Ver quem cita" });
  for (const n of D.notas.filter((n) => n.tipo === "projeto")) s.push({ cat: "Projeto", ic: "bolt", titulo: n.titulo, sub: limpo(n.resumo), meta: [["Área", n.area || "-"], ["Mexido", quando(n.mtime)]], href: nota(n.path), acao: "Abrir" });
  const fora = D.notas.filter((n) => n.tipo === "conceito" && !n.revisar_em).sort((a, b) => a.mtime - b.mtime).slice(0, 2);
  for (const n of fora) s.push({ cat: "Redescobrir", ic: "folha", titulo: n.titulo, sub: limpo(n.resumo), meta: [["Fora do ciclo", "nunca revisada"], ["Área", n.area || "-"]], href: nota(n.path), acao: "Reler" });
  return s.length ? s : [{ cat: "Tudo em dia", ic: "folha", titulo: "Nada pedindo atenção agora", sub: "Capture uma ideia ou abra uma nota antiga.", meta: [], href: "#/notas", acao: "Ver notas" }];
}

let idx = 0, SG = [];
function home() {
  SG = sugestoes();
  idx = Math.min(idx, SG.length - 1);
  const card = (s, i) => {
    const p = pinObj(i);
    return `<article class="card" data-i="${i}" style="background-image:url('${arte(i)}?amb')">
      <div class="card-main">
        <div class="card-top"><span class="tag glass">${icon(s.ic, 16)} ${esc(s.cat)}</span><span class="card-idx">${i + 1} / ${SG.length}</span></div>
        <div class="body">
          <p class="sub">${esc(s.sub)}</p>
          ${s.meta.length ? `<div class="meta">${s.meta.map(([k, v]) => `<span>${esc(k)}<b>${esc(v)}</b></span>`).join("")}</div>` : ""}
          <h2 class="${s.titulo.length > 44 ? "long" : ""}">${emLinks(s.raw || s.titulo)}</h2>
        </div>
        <div class="card-foot"><a class="btn peach go" href="${esc(s.href)}">${esc(s.acao)} ${icon("r", 16)}</a></div>
      </div>
      <div class="card-pin"><img src="${arte(i)}" alt="">${p?.link ? `<a class="pin-link" href="${esc(p.link)}" target="_blank">pinterest ↗</a>` : ""}</div>
    </article>`;
  };
  main.innerHTML = `<section class="car" id="car">${SG.map(card).join("")}
      <button class="navb glass l" data-act="prev" aria-label="Anterior">${icon("l")}</button>
      <button class="navb glass r" data-act="next" aria-label="Próxima">${icon("r")}</button>
      <div class="dots">${SG.map((_, i) => `<i data-act="ir" data-i="${i}"></i>`).join("")}</div>
    </section><section class="tiles" id="tiles"></section>`;
  posicionar(); tiles();
}
function posicionar() {
  document.querySelectorAll(".card").forEach((c) => {
    const n = SG.length, d = (Number(c.dataset.i) - idx + n) % n;
    const o = n > 2 && d > n / 2 ? d - n : d, a = Math.abs(o); // circular: vizinho dos dois lados
    c.style.transform = `translateX(${Math.sign(o) * Math.min(a, 1) * 92}%) scale(${o ? 0.84 : 1})`;
    c.style.opacity = a > 1 ? 0 : a ? 0.6 : 1;
    c.style.zIndex = 5 - a;
    c.classList.toggle("side", !!o);
    c.style.pointerEvents = a > 1 ? "none" : "";
  });
  document.querySelectorAll(".dots i").forEach((d, i) => d.classList.toggle("on", i === idx));
  if (SG[idx]) ambiente(arte(idx));
}
const mover = (d) => { idx = (idx + d + SG.length) % SG.length; posicionar(); };

function tiles() {
  const el = $("#tiles");
  if (!el) return;
  const prox = D.notas.filter((n) => n.revisar_em > D.hoje).sort((a, b) => a.revisar_em.localeCompare(b.revisar_em))[0];
  const on = S.servicos.filter((s) => s.ok).length;
  const nomes = { claude: "Claude", agy: "AGY", codex: "Codex", gemini: "Gemini" };
  el.innerHTML = `
    <a class="tile glass" href="#/agentes"><span class="k">${icon("agentes", 16)} Agentes ativos</span><span class="v">${S.agentes.length}</span>
      <span class="s">${esc(S.agentes.map((a) => `${nomes[a.nome] || a.nome} em ${a.cwd.split("/").pop() || "~"}`).join(" · ") || "nenhum rodando")}</span></a>
    <a class="tile glass" href="#/servicos"><span class="k">${icon("servicos", 16)} Serviços</span><span class="v">${on}/${S.servicos.length}</span>
      <span class="s">${esc(S.servicos.map((s) => `${s.ok ? "●" : "○"} ${s.nome}`).join("  ")) || "carregando"}</span></a>
    <a class="tile glass" href="#/revisar"><span class="k">${icon("revisar", 16)} Revisão</span><span class="v">${vencidas().length}</span>
      <span class="s">${prox ? `próxima: ${esc(prox.titulo)} ${rel.format(dias(D.hoje, prox.revisar_em), "day")}` : "nenhuma nota no ciclo"}</span></a>
    <a class="tile glass" href="#/notas"><span class="k">${icon("notas", 16)} Vault</span><span class="v">${D.notas.length}</span>
      <span class="s">${D.vermelhos.length} ${D.vermelhos.length === 1 ? "lacuna" : "lacunas"} · ${D.notas.filter((n) => Date.now() - n.mtime < 7 * 864e5).length} mexidas na semana</span></a>`;
}

// ---------------------------------------------------------------- Notas
let filtro = "", busca = "";
function notas() {
  const cont = {};
  for (const n of D.notas) cont[n.pasta[0]] = (cont[n.pasta[0]] || 0) + 1;
  main.innerHTML = `<div class="ph"><h1>Notas</h1><p>${D.notas.length} notas no vault</p>
      <div class="r"><input class="search glass" id="busca" placeholder="Buscar título ou resumo  /" value="${esc(busca)}" autocomplete="off"></div></div>
    <div class="filters">${[["", "Todas", D.notas.length], ...Object.entries(PASTAS).filter(([k]) => cont[k]).map(([k, v]) => [k, v, cont[k]])]
      .map(([k, v, c]) => `<button class="fchip ${filtro === k ? "on" : ""}" data-act="filtro" data-k="${k}">${v}<small>${c}</small></button>`).join("")}</div>
    <div class="grid" id="ngrid"></div>`;
  grade();
  ambiente(arte("notas"));
}
function grade() {
  const q = fold(busca);
  const peso = (n) => (!q ? 0 : fold(n.titulo).startsWith(q) ? 0 : fold(n.titulo).includes(q) ? 1 : 2);
  const ns = D.notas.filter((n) => (!filtro || n.pasta[0] === filtro) && (!q || fold(n.titulo + " " + n.resumo + " " + n.tags.join(" ")).includes(q)))
    .sort((a, b) => peso(a) - peso(b) || b.mtime - a.mtime);
  $("#ngrid").innerHTML = ns.map((n, i) => `<a class="nc glass" href="${nota(n.path)}" style="animation-delay:${Math.min(i, 12) * 25}ms">
      <h4>${esc(n.titulo)}</h4>
      <p>${esc(n.tipo === "diario" ? "Nota do dia" : limpo(n.resumo) || "Sem resumo de uma frase.")}</p>
      <span class="f">${n.tipo ? `<span class="pill">${esc(n.tipo)}</span>` : ""}${n.revisar_em ? '<span class="pill peach">no ciclo</span>' : ""}<span>${esc(n.area)}</span><span style="margin-left:auto">${quando(n.mtime)}</span></span></a>`).join("")
    || `<p class="empty">Nada com "${esc(busca)}".</p>`;
}

// ---------------------------------------------------------------- Leitor
async function leitor(path) {
  const n = await api(`/api/nota?path=${encodeURIComponent(path)}`).catch(() => null);
  if (!n) { main.innerHTML = `<p class="empty">Nota não encontrada.</p>`; return; }
  main.innerHTML = `<div class="reader">
    <article class="art glass">
      <div class="in"><h1>${esc(n.titulo)}</h1>
        <div class="chips">${[n.tipo, n.area, ...n.tags].filter(Boolean).map((t) => `<span class="pill">${esc(t)}</span>`).join("")}</div>
        <div class="prose" id="prose">${n.html}</div></div></article>
    <aside class="rail">
      <div class="box glass">
        <a class="btn peach" href="${obs(n.path)}">Abrir no Obsidian ${icon("ext", 16)}</a>
        ${n.revisar_em ? `<p class="empty" style="padding:10px 0 0">No ciclo: revisa ${n.revisar_em <= D.hoje ? "hoje" : rel.format(dias(D.hoje, n.revisar_em), "day")}, intervalo ${n.intervalo} d.</p>`
          : `<button class="btn glass" data-act="entrar" data-p="${esc(n.path)}">Colocar no ciclo de revisão</button>`}</div>
      <div class="box glass"><h3>Citada por</h3>${n.backlinks.map((b) => `<a class="l" href="${nota(b.path)}">${esc(b.titulo)}</a>`).join("") || '<p class="empty" style="padding:0">Ninguém cita ainda.</p>'}</div>
      <div class="box glass"><h3>Cita</h3>${[...new Set(n.links)].map((l) => `<a class="l" href="#/w/${encodeURIComponent(l)}" style="${resolver(l) ? "" : "opacity:.5"}">${esc(l)}</a>`).join("") || '<p class="empty" style="padding:0">Nenhum link.</p>'}</div>
    </aside></div>`;
  // Callout do Obsidian: blockquote que começa com [!tipo] Título.
  document.querySelectorAll("#prose blockquote").forEach((b) => {
    const p = b.querySelector("p");
    const m = p?.innerHTML.match(/^\[!(\w+)\]\s*([^\n<]*)(?:<br\s*\/?>|\n)?/);
    if (!m) return;
    b.classList.add("co", m[1]);
    p.innerHTML = `<span class="ct">${m[2] || m[1]}</span>` + p.innerHTML.slice(m[0].length);
  });
  ambiente(arte(n.titulo));
  scrollTo({ top: 0 });
}
function wiki(nome) {
  const n = resolver(nome);
  if (n) return location.replace(nota(n.path));
  const quem = D.notas.filter((x) => x.links.includes(nome));
  main.innerHTML = `<div class="ph"><h1>${esc(nome)}</h1><p>Lacuna: ainda não existe. Link vermelho é backlog honesto, não erro.</p></div>
    <h3>Citada por</h3><div class="list glass">${quem.map((x) => `<a class="row" href="${nota(x.path)}"><span class="t">${esc(x.titulo)}<small>${esc(x.resumo)}</small></span></a>`).join("") || '<p class="empty">Ninguém.</p>'}</div>
    <p class="empty" style="padding:18px 0">Para escrever: peça ao agente "escreve a nota ${esc(nome)}" ou crie no Obsidian. Não clique no link vermelho só para criar arquivo vazio.</p>`;
  ambiente(arte(nome));
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
    main.innerHTML = `<div class="ph"><h1>${feitas ? `${feitas} revisada${feitas > 1 ? "s" : ""}. Feito.` : "Nada vencido hoje"}</h1>
        <p>Lembrou dobra o intervalo; esqueceu volta para 1 dia.</p></div>
      <h3>Próximas</h3><div class="list glass">${prox.slice(0, 8).map((x) => `<a class="row" href="${nota(x.path)}"><span class="t">${esc(x.titulo)}</span><span class="x">${x.revisar_em} · ${x.intervalo} d</span></a>`).join("") || '<p class="empty">Nenhuma nota no ciclo ainda.</p>'}</div>
      <h3>Colocar no ciclo</h3><div class="list glass">${fora.map((x) => `<div class="row hov"><a class="t" href="${nota(x.path)}">${esc(x.titulo)}<small>${esc(limpo(x.resumo))}</small></a>
        <button class="btn glass" data-act="entrar" data-p="${esc(x.path)}">Entrar</button></div>`).join("") || '<p class="empty">Todas já estão.</p>'}</div>`;
    ambiente(arte("revisar"));
    return;
  }
  main.innerHTML = `<section class="flash glass">
      <span class="n">${pos + 1} de ${fila.length} · ${esc(n.pasta)}</span>
      <h2>${esc(n.titulo)}</h2>
      ${aberta ? `<p class="ans glass">${esc(limpo(n.resumo) || "Sem resumo de uma frase. Abra a nota.")}</p>
        <div class="acts"><button class="btn glass" data-act="nao">Não lembrei <kbd>1</kbd></button><button class="btn peach" data-act="sim">Lembrei <kbd>2</kbd></button>
        <a class="btn glass r" href="${nota(n.path)}">Ler a nota</a></div>`
      : `<div class="acts"><button class="btn peach" data-act="mostrar">Mostrar resposta <kbd>espaço</kbd></button></div>`}
    </section>`;
  ambiente(arte(n.titulo));
}
async function responder(lembrou) {
  const n = fila[pos];
  const r = await api("/api/revisar", { path: n.path, lembrou });
  toast(`${n.titulo}: volta em ${r.intervalo} d`);
  pos++; aberta = false; feitas++;
  D = await api("/api"); topo(); cartao();
}

// ---------------------------------------------------------------- Grafo
let grafoStop = null;
function grafo() {
  main.innerHTML = `<div class="ph"><h1>Grafo</h1><p>Clique abre a nota. Arraste para mover.</p></div>
    <section class="graph glass"><canvas id="cv"></canvas><div class="legend" id="leg"></div></section>`;
  const cv = $("#cv"), ctx = cv.getContext("2d"), dpr = devicePixelRatio || 1;
  const cores = { programacao: "#f4b88f", cc: "#8fc7f4", ia: "#c9a3ff", matematica: "#9be3b5" };
  const nodes = D.notas.filter((n) => n.tipo !== "diario").map((n) => ({ id: nomeDe(n.path), t: n.titulo, p: n.path, c: cores[n.area] || "#d8d2ca" }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const v of D.vermelhos) if (!byId.has(v.alvo)) { const g = { id: v.alvo, t: v.alvo, c: "rgba(255,255,255,.25)", ghost: true }; nodes.push(g); byId.set(v.alvo, g); }
  const edges = [];
  for (const n of D.notas) for (const l of new Set(n.links)) { const a = byId.get(nomeDe(n.path)), b = byId.get(l); if (a && b && a !== b) edges.push([a, b]); }
  const deg = new Map();
  for (const [a, b] of edges) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
  let W, H;
  const size = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size();
  nodes.forEach((n, i) => { const a = i * 2.4; n.x = W / 2 + Math.cos(a) * (60 + i * 6); n.y = H / 2 + Math.sin(a) * (60 + i * 6); n.vx = n.vy = 0; n.r = 4 + Math.sqrt(deg.get(n) || 0) * 2.5; });
  let hover = null, drag = null, calor = 1;
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
  function desenhar() {
    ctx.clearRect(0, 0, W, H);
    const viz = hover ? new Set(edges.filter(([a, b]) => a === hover || b === hover).flat()) : null;
    for (const [a, b] of edges) {
      ctx.strokeStyle = viz && (a === hover || b === hover) ? "rgba(244,184,143,.7)" : "rgba(255,255,255,.1)";
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (const n of nodes) {
      ctx.globalAlpha = viz && !viz.has(n) && n !== hover ? 0.25 : 1;
      ctx.fillStyle = n.c; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill();
      if (n === hover || (!hover && (deg.get(n) || 0) >= 5) || viz?.has(n)) {
        ctx.fillStyle = n.ghost ? "rgba(243,239,233,.45)" : "rgba(243,239,233,.85)";
        ctx.font = "500 12px Inter, sans-serif"; ctx.fillText(n.t.length > 34 ? n.t.slice(0, 32) + "…" : n.t, n.x + n.r + 5, n.y + 4);
      }
    }
    ctx.globalAlpha = 1;
  }
  let vivo = true;
  // Para quando assenta: só volta a animar com o mouse em cima (economiza CPU parado na aba).
  let parado = false;
  const loop = () => { if (!vivo) return; passo(); desenhar(); if (calor > 0.06 || drag) requestAnimationFrame(loop); else parado = true; };
  const acordar = () => { if (parado) { parado = false; requestAnimationFrame(loop); } };
  loop();
  grafoStop = () => { vivo = false; };
  const achar = (e) => { const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return nodes.find((n) => Math.hypot(n.x - x, n.y - y) < n.r + 4); };
  let moveu = false;
  cv.onpointermove = (e) => { acordar(); if (drag) { const r = cv.getBoundingClientRect(); drag.x = e.clientX - r.left; drag.y = e.clientY - r.top; moveu = true; calor = Math.max(calor, 0.3); } else { hover = achar(e); cv.style.cursor = hover ? "pointer" : "grab"; } };
  cv.onpointerdown = (e) => { drag = achar(e); moveu = false; };
  cv.onpointerup = () => { if (drag && !moveu) location.hash = drag.ghost ? `#/w/${encodeURIComponent(drag.id)}` : nota(drag.p); drag = null; };
  $("#leg").innerHTML = Object.entries(cores).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join("") + '<span><i style="background:rgba(255,255,255,.25)"></i>lacuna</span>';
  ambiente(arte("grafo"));
}

// ---------------------------------------------------------------- Agentes
const ROT = {
  "bom-dia": ["Bom dia", "Monta o Foco de hoje na nota do dia: revisões, prova próxima, inbox, lacunas."],
  inbox: ["Inbox", "Processa 1 Inbox/: cada item vira nota no padrão ou fica, com o motivo."],
};
const NOME_AG = { claude: ["Claude Code", "agentes"], agy: ["Antigravity", "bolt"], codex: ["Codex", "agentes"], gemini: ["Gemini", "spark"] };
function agentes() {
  main.innerHTML = `<div class="ph"><h1>Agentes</h1><p>Claude e AGY seguem o mesmo <code>AGENTS.md</code>. Rotina roda no AGY.</p></div>
    <h3>Rodando agora</h3><div class="cards">${S.agentes.map((a) => {
      const [nome, ic] = NOME_AG[a.nome] || [a.nome, "agentes"];
      return `<a class="ag glass link" href="#/a/${a.chave}"><div class="hd"><span class="ic">${icon(ic)}</span><div><h4>${nome}</h4><small>${esc(a.cwd)}</small></div><span class="live" style="margin-left:auto"></span></div>
        <div class="ft"><span class="pill">pid ${a.pid}</span><span class="pill">há ${duracao(a.segundos)}</span><span class="ver">ver ao vivo ${icon("r", 14)}</span></div></a>`;
    }).join("") || '<p class="empty">Nenhum agente rodando.</p>'}</div>
    ${S.fundo?.length ? `<h3>Em segundo plano</h3><div class="cards">${S.fundo.map((f) => `<a class="ag glass link" href="#/a/${f.chave}">
        <div class="hd"><span class="ic">${icon("agentes")}</span><div><h4>${esc(f.titulo)}</h4><small>Claude Code · ${esc(f.cwd)}</small></div>
        <span class="live ${f.estado === "blocked" ? "run" : f.estado === "done" ? "idle" : ""}" style="margin-left:auto"></span></div>
        ${f.precisa ? `<p class="need">${esc(f.precisa)}</p>` : ""}
        <div class="ft"><span class="pill ${f.estado === "blocked" ? "peach" : ""}">${ESTADO[f.estado] || f.estado}</span><span class="pill">${quando(f.desde)}</span><span class="ver">abrir ${icon("r", 14)}</span></div></a>`).join("")}</div>` : ""}
    <h3>Rotinas</h3><div class="cards">${Object.entries(ROT).map(([k, [nome, desc]]) => {
      const r = S.rotinas[k];
      const st = !r ? "nunca rodou nesta sessão" : !r.fim ? `rodando desde ${r.inicio.slice(11)}` : `${r.ok ? "terminou" : "falhou"} às ${r.fim.slice(11)}`;
      return `<div class="ag glass"><div class="hd"><span class="ic">${icon(k === "inbox" ? "inbox" : "alvo")}</span><div><h4>${nome}</h4><small>${desc}</small></div></div>
        <div class="ft"><span class="live ${!r ? "idle" : !r.fim ? "run" : r.ok ? "" : "off"}"></span><small>${st}</small>${r && !r.fim && S.agentes.find((x) => x.pid === r.pid)?.chave ? `<a class="ver" href="#/a/${S.agentes.find((x) => x.pid === r.pid).chave}">ver ao vivo</a>` : ""}
        <button class="btn peach" style="margin-left:auto" data-act="rotina" data-k="${k}" ${r && !r.fim ? "disabled" : ""}>${icon("play", 14)} Rodar no AGY</button></div></div>`;
    }).join("")}</div>
    <h3>Log</h3><div class="list glass">${D.log.map((l) => {
      const [q, quem, ...resto] = l.split(" · ");
      return `<div class="row"><span class="who">${esc(quem)}</span><span class="txt">${comLinks(resto.join(" · "))}</span><span class="x">${esc(q.slice(5).replace("-", "/"))}</span></div>`;
    }).join("") || '<p class="empty">Nenhuma execução registrada.</p>'}</div>
    <h3>Achados</h3><div class="list glass">${D.achados.map((a) => { const [d, ...t] = a.split(" · "); return `<div class="row"><span class="txt">${esc(t.join(" · "))}</span><span class="x">${esc(d)}</span></div>`; }).join("")}</div>`;
  ambiente(arte("agentes"));
}

// ---------------------------------------------------------------- Agente ao vivo
// Lê a conversa no disco (Claude: .jsonl da sessão; AGY: SQLite) a cada 3 s, só com a página aberta.
// A caixa de mensagem é desenhada uma vez; só cabeçalho e feed se atualizam, para não apagar o que você digita.
const QUEM = { voce: "você", resultado: "resultado" };
// Markdown mínimo (negrito, código, título) aplicado DEPOIS de escapar: texto da conversa nunca vira HTML.
const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/^#{1,4} (.+)$/gm, "<b>$1</b>");
const ESTADO = { blocked: "esperando você", working: "trabalhando", running: "trabalhando", done: "terminou", idle: "parado" };
let agTimer = null, agUltimo = "";
async function agentePg(chave) {
  clearInterval(agTimer); agUltimo = "";
  main.innerHTML = `<div class="ph" id="aghead"></div><div id="agprecisa"></div><div class="feed list glass" id="feed"><p class="empty">Lendo a conversa…</p></div>
    <form class="falar glass" id="falar"><textarea id="msg" rows="2" placeholder="Mandar mensagem… Enter envia, Shift+Enter quebra linha" aria-label="Mensagem para o agente"></textarea>
      <button class="btn peach" type="submit">Enviar ${icon("r", 14)}</button><small id="falardica"></small></form>`;
  const desenha = async () => {
    if (rota().pg !== "a" || rota().arg !== chave) return clearInterval(agTimer);
    const a = await api(`/api/agente?chave=${encodeURIComponent(chave)}`).catch(() => null);
    if (!a) { main.innerHTML = `<div class="ph"><h1>Conversa não encontrada</h1></div><a class="btn glass" href="#/agentes">Voltar para Agentes</a>`; return clearInterval(agTimer); }
    const assinatura = a.vivo + a.estado + a.eventos.length + (a.eventos.at(-1)?.txt || "");
    if (assinatura === agUltimo) return;
    agUltimo = assinatura;
    const nome = a.titulo || NOME_AG[a.nome]?.[0] || a.nome;
    const status = a.vivo ? "rodando" : ESTADO[a.estado] || "parado";
    $("#aghead").innerHTML = `<h1>${esc(nome)}</h1><p>${esc(NOME_AG[a.nome]?.[0] || a.nome)} · ${esc(a.cwd)}${a.pid ? ` · pid ${a.pid}` : ""}${a.segundos ? ` · há ${duracao(a.segundos)}` : ""}</p>
      <div class="r"><span class="live ${a.vivo ? "" : a.estado === "blocked" ? "run" : "idle"}"></span><small style="color:var(--muted)">${status} · atualiza a cada 3 s</small></div>`;
    $("#agprecisa").innerHTML = a.precisa ? `<div class="precisa glass"><b>Precisa de você</b>${fmt(a.precisa)}</div>` : "";
    $("#falardica").textContent = a.nome === "agy" ? "Continua esta conversa no AGY (agy -p --conversation)."
      : a.vivo ? "Esta sessão está aberta num terminal: a resposta vem numa cópia em segundo plano, e o terminal fica intacto."
      : "Continua esta sessão em segundo plano (claude --bg --resume).";
    const feed = $("#feed"), noFim = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    feed.innerHTML = a.eventos.map((e) => `<div class="row ev ${e.t}">
        <span class="who">${esc(QUEM[e.t] ?? (e.t === "ferramenta" ? e.nome : a.nome))}</span>
        <div class="txt">${e.t === "texto" || e.t === "voce" ? fmt(e.txt) : esc(e.txt)}</div>
        <span class="x">${e.quando ? new Date(e.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</span></div>`).join("")
      || `<p class="empty">Nada para mostrar ainda.</p>`;
    if (noFim) feed.scrollTop = feed.scrollHeight;
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
  ambiente(arte(`agente ${chave}`));
}

// ---------------------------------------------------------------- Serviços
function servicos() {
  main.innerHTML = `<div class="ph"><h1>Serviços</h1><p>Os localhost da máquina e o Pinterest. Lista em <code>painel/servicos.json</code>.</p></div>
    <div class="cards">${S.servicos.map((s) => {
      if (s.interno === "pinterest") {
        const p = s.pinterest || {};
        const pasta = p.board ? `https://br.pinterest.com/${p.board.replace(/^\/|\/$/g, "")}/` : s.url;
        return `<div class="ag glass"><div class="hd"><span class="ic">${icon(s.icone || "livro")}</span>
            <div><h4>${esc(s.nome)}</h4><small>${esc(p.status === "erro" ? p.erro : s.desc)}</small></div><span class="live ${s.ok ? "" : p.status === "erro" ? "off" : "idle"}" style="margin-left:auto"></span></div>
          <div class="ft"><span class="pill">${esc(p.board || "pinterest")}</span><span class="pill">${p.total ?? 0} imagens</span>
            <span style="margin-left:auto;display:flex;gap:6px"><button class="btn glass" data-act="pinsync" ${p.sincronizando ? "disabled" : ""}>${p.sincronizando ? "Sincronizando…" : "Sincronizar agora"}</button>
            <a class="btn peach" href="${esc(pasta)}" target="_blank">Abrir ${icon("ext", 14)}</a></span></div></div>`;
      }
      return `<div class="ag glass"><div class="hd"><span class="ic">${icon(s.icone || "servicos")}</span>
          <div><h4>${esc(s.nome)}</h4><small>${esc(s.desc)}</small></div><span class="live ${s.ok ? "" : "off"}" style="margin-left:auto"></span></div>
        <div class="ft"><span class="pill">${esc(new URL(endereco(s) || s.url).host)}</span><span class="pill">${s.ok ? `${s.ms} ms` : "fora do ar"}</span>
          <span style="margin-left:auto;display:flex;gap:6px">${s.ok && endereco(s) && !s.interno ? `<a class="btn glass" href="#/s/${esc(s.id)}">Ver aqui</a>` : ""}
          <a class="btn peach" href="${esc(remoto ? endereco(s) || "#/servicos" : s.url)}" target="_blank">Abrir ${icon("ext", 14)}</a></span></div></div>`;
    }).join("")}</div>`;
  ambiente(arte("servicos"));
}

// ---------------------------------------------------------------- Serviço embutido
function servico(id) {
  const s = S.servicos.find((x) => x.id === id);
  if (!s) { main.innerHTML = '<p class="empty">Serviço não encontrado em painel/servicos.json.</p>'; return; }
  const src = endereco(s), aba = remoto ? src : s.url;
  $("#svcbar").innerHTML = `<span class="live ${s.ok ? "" : "off"}"></span><span class="pill">${esc(new URL(src || s.url).host)}${s.ok ? ` · ${s.ms} ms` : " · fora do ar"}</span>
    <button class="btn glass" data-act="recarregar" aria-label="Recarregar" data-tip="Recarregar">${icon("reload", 15)}</button>
    <a class="btn glass" href="${esc(aba)}" target="_blank" aria-label="Abrir em aba">${icon("ext", 15)}</a>`;
  main.innerHTML = `<div class="frame ${s.largura ? "phone" : ""}" style="${s.largura ? `--w:${s.largura}px` : s.max ? `max-width:${s.max}px;margin:0 auto` : ""}">
      ${!src ? `<p class="empty">${esc(s.nome)} não está publicado no Tailscale (campo "tailnet" em painel/servicos.json).</p>`
        : s.ok ? `<iframe id="svcf" src="${esc(src)}" title="${esc(s.nome)}"></iframe>` : `<p class="empty">${esc(s.nome)} está fora do ar.</p>`}</div>`;
  ambiente(arte(s.nome));
}

// ---------------------------------------------------------------- rotas e eventos
const PAGINAS = { "": [home, "Home"], notas: [notas, "Notas"], n: [leitor, "Nota"], w: [wiki, "Nota"], revisar: [revisar, "Revisar"], grafo: [grafo, "Grafo"], agentes: [agentes, "Agentes"], servicos: [servicos, "Serviços"], s: [servico, "Serviço"], a: [agentePg, "Agente"] };
function rota() { const [, pg = "", ...r] = location.hash.split("/"); return { pg: PAGINAS[pg] ? pg : "", arg: decodeURIComponent(r.join("/")) }; }
function render() {
  if (!D) return;
  grafoStop?.(); grafoStop = null;
  const { pg, arg } = rota();
  $("#crumb").textContent = pg === "a" ? S.fundo?.find((x) => x.chave === arg)?.titulo || NOME_AG[S.agentes.find((x) => x.chave === arg)?.nome]?.[0] || "Agente" : pg === "s" ? S.servicos.find((s) => s.id === arg)?.nome || "Serviço" : PAGINAS[pg][1];
  document.body.classList.toggle("app", pg === "s"); // app embutido ganha a altura da faixa da semana
  if (pg !== "s") $("#svcbar").innerHTML = "";
  main.style.animation = "none"; main.offsetHeight; main.style.animation = "";
  topo();
  PAGINAS[pg][0](arg);
}

const ACOES = {
  prev: () => mover(-1), next: () => mover(1), ir: (el) => { idx = Number(el.dataset.i); posicionar(); },
  filtro: (el) => { filtro = el.dataset.k; notas(); },
  mostrar: () => { aberta = true; cartao(); }, sim: () => responder(true), nao: () => responder(false),
  entrar: async (el) => { await api("/api/revisar", { path: el.dataset.p, lembrou: false }); toast("No ciclo: primeira revisão amanhã"); D = await api("/api"); render(); },
  rotina: async (el) => {
    try { await api("/api/rotina", { nome: el.dataset.k }); toast("Rotina disparada no AGY"); } catch (e) { toast(e.message); }
    S = await api("/api/sistema"); agentes(); topo();
  },
  pinsync: async (el) => {
    el.disabled = true; el.textContent = "Sincronizando…";
    try {
      const p = await api("/api/pinterest/sync", {});
      toast(p.status === "ok" ? `${p.imagens.length} imagens no cache` : p.erro || "Erro ao sincronizar");
    } catch (e) { toast(e.message); }
    [D, S] = await Promise.all([api("/api"), api("/api/sistema")]); servicos(); topo();
  },
  recarregar: () => { const f = $("#svcf"); f.src = f.src; },
  pinamb: (el) => { ambiente(`/pin/${el.dataset.id}`); toast("Fundo ambiente atualizado"); },
  capturar: () => { $("#capdia").textContent = D.hoje; $("#cap").showModal(); $("#capt").focus(); },
};
document.addEventListener("click", (e) => {
  if (e.target.closest("a[target]")) return;
  const el = e.target.closest("[data-act]");
  if (el) { e.preventDefault(); ACOES[el.dataset.act]?.(el); return; }
  const side = e.target.closest(".card.side");
  if (side) { e.preventDefault(); idx = Number(side.dataset.i); posicionar(); }
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
  if (e.target.matches("input, textarea") || document.querySelector("dialog[open]")) return;
  const { pg } = rota();
  if (e.key === "c") { e.preventDefault(); ACOES.capturar(); }
  if (e.key === "/" && pg === "notas") { e.preventDefault(); $("#busca").focus(); }
  if (!pg && e.key === "ArrowLeft") mover(-1);
  if (!pg && e.key === "ArrowRight") mover(1);
  if (pg === "revisar" && fila[pos]) {
    if (e.key === " " && !aberta) { e.preventDefault(); ACOES.mostrar(); }
    if (aberta && e.key === "1") responder(false);
    if (aberta && e.key === "2") responder(true);
  }
});
// Swipe no carrossel.
let x0 = null;
document.addEventListener("pointerdown", (e) => { x0 = e.target.closest("#car") ? e.clientX : null; });
document.addEventListener("pointerup", (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 60) mover(e.clientX < x0 ? 1 : -1); x0 = null; });

addEventListener("hashchange", render);
async function vault() { D = await api("/api"); }
async function sistema() { S = await api("/api/sistema"); }
// Fluido: sistema a cada 10 s (agentes, serviços), vault ao voltar para a aba e a cada minuto.
setInterval(async () => {
  await sistema(); topo();
  const { pg } = rota();
  if (!pg) tiles(); else if (pg === "agentes" || pg === "servicos") PAGINAS[pg][0]();
}, 10000);
setInterval(async () => { await vault(); topo(); if (!rota().pg) tiles(); }, 60000);
addEventListener("focus", async () => { await vault(); topo(); const { pg } = rota(); if (!pg) home(); else if (pg === "notas") grade(); });
setInterval(relogio, 1000);
relogio();
Promise.all([vault(), sistema()]).then(render);

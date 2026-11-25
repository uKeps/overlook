# Overlook

**A canvas for your coding agents, on top of your notes.** Terminals, Claude Code and Antigravity sessions, real
browser cards, sticky notes and drawings share one infinite canvas. Wire them together and the agents read each
other's screens, hand work off and open cards of their own. It runs on your machine, reads your Obsidian vault
straight from disk (no database, no cloud) and is MIT licensed.

[![MIT](https://img.shields.io/badge/license-MIT-e8a87c)](LICENSE)
[![Bun](https://img.shields.io/badge/runs%20on-Bun-f3efe9)](https://bun.sh)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-8b5cf6)](#contributing)

![Overlook's canvas: agent terminals, a note wired to them, a browser card with tabs and a drawing](docs/screenshots/canvas.gif)

## Why

- **Agents side by side, not in tabs.** Run several Claude Code, agy, Codex or Gemini sessions as cards and see at a
  glance which one is working, waiting for you or done: its ring and its block on the minimap say so.
- **Wires are context.** Draw a wire from a note, a terminal or a browser card to an agent and it gets that as
  context, out of sight. Agents talk over wires: `overlook send`, `overlook read`, and `overlook spawn`, which lets a
  lead agent open helpers on the canvas and wait for their reports.
- **A real browser on the canvas.** In the desktop app a browser card is Chromium: tabs, private tabs, ad blocking,
  your logins, sound and video. Agents drive the page you see (`overlook browser open|read|click|type`).
- **Draw your reasoning.** Excalidraw sits on the canvas; agents read it (`overlook sketch`) and draw Mermaid
  diagrams next to their card (`overlook draw`). Ctrl+Z undoes cards, wires and strokes alike.
- **Your vault, your day.** A to-do that understands "tomorrow 9am every Monday", a note reader with backlinks and a
  graph, review cards that come back until you know them, quick capture into the daily note.
- **On your phone.** Over Tailscale: the same terminals full screen, the to-do first, and a notification when an
  agent waits for you.

| Home | Note reader | Phone |
| --- | --- | --- |
| ![Home: today's tasks and what's coming](docs/screenshots/home.jpg) | ![A note with its links](docs/screenshots/note.jpg) | ![The phone layout](docs/screenshots/phone.jpg) |

## Quick start

Needs [Bun](https://bun.sh) 1.4+. Built and tested on Linux.

```sh
git clone https://github.com/uKeps/overlook && cd overlook
cp .env.example .env
bun install
bun server.ts
```

Open http://127.0.0.1:3333, or run `desktop/run` for the desktop app (any Electron: your distro's `electron`
package, or `ELECTRON_BIN`). It starts on the bundled `example-vault/`. Point `VAULT_DIR` in `.env` at your own
vault (or set it in **Settings**) and restart. Run it from the repo folder: Bun reads `.env` from there.

## What's in it

- **Home**: in Minimal, a to-do list. Type a task in one line and its date, time, repeat and importance come out of
  the words ("pay the server on the 15th every month", "revisar PR amanhã 9h toda segunda", "!"); late ones roll into
  today, a repeating one comes back on its next date when done, and a click opens it to change any of that. Beside
  it, what needs you: an agent waiting for an answer, a card to review, the inbox. Tasks with a time notify you.
  Classic keeps the carousel: today's focus, reviews, the inbox, links to notes that don't exist yet.
- **Calendar** strip: events from `Calendar.md` (`- 2026-11-03 14:00 · Exam`) and agent tasks scheduled to run
  once or on a repeat.
- **Notes**, a reader with backlinks, a graph and full-text search (`/`). Quick capture (`C`) puts a line in the daily
  note, or gives a topic to an agent that researches it and writes the note.
- **Graph**: a map of the notes in columns by type (database → table → worker → platform → system → process → team),
  read from `type` in the frontmatter. Click a note to see what it links to (1–3 steps); "What depends on it" lights
  what may break if it changes and can hand that list to an agent. Vaults without those types get the force graph.
- **Review**: what you ask the vault comes back as a card in 1, 2, 4… days until you know it. Asking on Notes, the
  agent that answers adds the card to `Review.md`; "Save as a note" adds one for the new note. One card at a time
  waits on the Home; the page lists them all. Remove what is useless or out of date; known ones leave on their own.
- **Agents**: give a task to any CLI or API agent and watch it run. The canvas takes the whole screen, and every
  card is a window: real terminals, agent TUIs (Claude Code, Antigravity), stickies and notes. Right-click opens a
  card's or the canvas's menu, `Delete` closes the selected cards, and a minimap shows where you are. Agents waiting
  for you show on Home and ring a notification. A terminal gets its screen back when you reload the page. Wire two
  terminal cards and the programs in them can talk with
  `overlook peers`, `overlook send <card> "…"` and `overlook read <card>`. Ctrl+Alt+/ lists the canvas's shortcuts.
- **Keys**: `/` search, `C` capture, `V` Classic or Minimal, `F` full screen (no browser tabs), `←`/`→` the previous
  or next page.
- Themes (Tokyo Night, Dracula, Catppuccin, Rosé Pine, Gruvbox, Nord) and two interfaces, Classic and Minimal.

## Your vault

The default layout, which the demo vault follows:

| Path | Used for |
| --- | --- |
| `1 Inbox/` … `8 …/` | Notes: folders starting with a digit 1–8 and a space (`7 …`, drawings, is skipped) |
| `*.md` at the root | Notes too, except `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `Calendar.md`, `Tasks.md` and `Review.md` |
| `Tasks.md` | The to-do list, in the Obsidian Tasks format (`- [ ] what 🔁 every week 📅 2026-11-12`): edit it there too |
| `Review.md` | The review cards, one line each: `- question :: answer [[note]]`; Overlook adds the schedule in a comment |
| `2 Daily/YYYY-MM-DD.md` | Daily note: `## Focus` feeds the Home, captures land in `## Captured` |
| `9 Agent/Log.md`, `Findings.md` | Optional agent log and gotchas |
| `AGENTS.md` | Optional instructions for agents; with it, the Morning and Inbox routines show up |

Frontmatter, all optional: `type` (concept, project, daily), `area`, `tags`, `confidence`, `updated`
(a note still carrying the older `review_on` / `interval` shows up as a review card). A `> [!abstract]` callout right after the title is the note's summary.
`VAULT_LANG=pt` reads the Portuguese names instead (`2 Diário`, `## Foco de hoje`, `Tarefas.md`, `Revisão.md`…).

Laid out another way? A `vault.json` next to `agents.json` renames what you need. Every key is optional:

```json
{
  "folders": ["Inbox", "Notes", "Projects", "Journal"],
  "inbox": "Inbox",
  "daily": "Journal",
  "focus": "Today",
  "captured": "Captured",
  "keys": { "type": "kind" }
}
```

Also `log`, `findings`, `calendar` and `types`. Save Settings or restart after editing it.

## Configuration

Everything is optional, and **Settings** edits most of it. Personal files stay out of git.

| File | What it holds | Start from |
| --- | --- | --- |
| `.env` | Vault path and language, port, API keys, `TRANSCRIBE` | `.env.example` |
| `agents.json` | The agents you can run (default: `claude`, `agy`, `codex`, `gemini` when on the `PATH`) | `agents.example.json` |
| `vault.json` | Your vault's layout (above) | — |
| `services.json` | Local apps to ping and embed | `services.example.json` |
| `pinterest.json` | Card image choices and the Pinterest board | `pinterest.example.json` |
| `schedule.json` | Scheduled agent tasks (written by the calendar) | — |

### Agents

Each `agents.json` entry is one of two kinds:

- **CLI**: `run` is the command, with `{prompt}` where the task goes (plus `{model}`, `{effort}`, `{session}`).
  It runs in the vault with that CLI's own permissions. Optional: `process` (to spot it running), `tui` (opens
  it on the canvas; `{log}` there names a log file the conversation id is read from, for CLIs like agy that
  can't take a session id up front), `open` (buttons that resume a session elsewhere), `canvas` (args that tell it about wires).
- **API**: `api` is `anthropic` or `openai` (any OpenAI-compatible endpoint: OpenRouter, Groq, Ollama), with
  `model`, an optional `url`, and `key`, the `.env` variable holding the key. It gets four tools limited to the
  vault's notes (`list_notes`, `search_notes`, `read_note`, `write_note`), and `AGENTS.md` as instructions.

On the canvas, what the user wires to an agent's card (notes, terminals, browsers) reaches it through a hook when
the agent has one: Claude Code gets it from `canvas` (`--settings`), agy from a plugin installed once with
`agy plugin install integrations/agy`. Both get it with the next prompt, out of sight. An agent without a hook gets
it typed in as a prompt once it sits idle.

Any entry can list `models` and `efforts`; the task form then offers them. A request that names no agent goes to
the first one in the file that can run here. `agents.example.json` has one of each.

### Optional pieces

- **Card images**: a folder of your photos or a public Pinterest board (`user/board`), set in Services →
  *Manage images*. With neither, the cards show animated ascii scenes from [ascii.rest](https://ascii.rest).
  A private board needs a [Pinterest app](https://developers.pinterest.com/apps/) with redirect URI
  `http://127.0.0.1:3333/auth/pinterest/callback`: put its `PINTEREST_CLIENT_ID` / `PINTEREST_CLIENT_SECRET` in
  `.env` and open `/auth/pinterest`.
- **Voice memos**: set `TRANSCRIBE` to a command that reads audio on stdin and prints the text (e.g. a whisper
  script). `POST /api/voice` with `{"audio": "<base64>", "name": "Walk.m4a"}` turns the recording into an inbox
  note and hands it to an agent to file. A failure lands in today's note.
- **Phone access**: the server only listens on 127.0.0.1, but accepts your Tailscale machine name, so
  `tailscale serve --bg 3333` opens it to your devices over HTTPS.
- **ImageMagick** (`magick`) downscales and caches images; without it, originals are served.
- **Desktop app**: `desktop/run` opens Overlook in a window of its own with any Electron you have (`electron`,
  your distro's `electronNN`, or `ELECTRON_BIN`). There a browser card is a real browser: tabs (Ctrl+T, Ctrl+W,
  Ctrl+Tab), private tabs (Ctrl+Shift+N, kept in memory only), ad and tracker blocking, popups for sign-ins,
  downloads, uploads, sound, video and a right-click menu with Inspect. The card's ≡ menu imports your logins from
  Zen/Firefox or Brave. The web page keeps working as before. `PORT` or `OVERLOOK_APP_URL` points it at another
  Overlook.

## Run on login (Linux, systemd)

```ini
# ~/.config/systemd/user/overlook.service
[Service]
WorkingDirectory=%h/overlook
ExecStart=/usr/bin/bun server.ts
Restart=on-failure

[Install]
WantedBy=default.target
```

`systemctl --user enable --now overlook`

## For agents

`bun server.ts map` prints one line per note; `bun server.ts today` prints what the Home shows, today's tasks included.
`bin/overlook todo "…"` adds a to-do from any terminal (`overlook todo` alone lists today's).

## Contributing

`main` changes through pull requests whose title is a [Conventional Commit](https://www.conventionalcommits.org)
(`feat: …`, `fix(review): …`), squash-merged once CI is green. CI scans the history for secrets and runs
`bun test`, which boots the server on `example-vault/` and runs agents against fake providers. Run
`bun install && bun test` before pushing.

## License

MIT

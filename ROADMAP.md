# Overlook — Roadmap

## Now
<!-- In progress. At most 3. -->
- [ ] N1 — Make the repo public (README, demo vault, personal config out of git) — next step: merge `chore/public-ready` into main, rename GitHub repo to `overlook`, push, flip visibility

## Next
1. Have a second person (a friend) clone and run it from the README — why: the only real test of "works for anyone"

## Debt
| ID | Problem | Risk if ignored | Fix idea |
|----|---------|-----------------|----------|
| D1 | Routines `bom-dia`/`inbox` (server.ts `ROTINAS`) assume `agy` plus an `AGENTS.md` with a "Rotinas" section in the vault | Other users click "Rodar no AGY" and get a meaningless run | Hide routines when the vault has no `AGENTS.md`, or ship a sample one in `example-vault/` |
| D2 | Art thumbnails cached in `~/.cache/hq-arte` keyed by filename only | Two `ART_DIR`s with same filenames show each other's images | Key the cache by path hash |
| D3 | Public Pinterest boards are read by scraping the board page (`pinsPublicos` in pinterest.ts) | Breaks silently when Pinterest changes its HTML | Official API path already exists; document it as the stable option |
| D4 | Vault layout (folders `1`–`8`, `2 Diário`, pt-BR section names) is hardcoded | Vaults with another structure show mostly empty | See Ideas: configurable layout |

## Decisions pending
- O2 — Git history still holds the old `servicos.json` and `pinterest.json` (local ports, board name `uKeps/sla`; no secrets) — options: keep / rewrite history — recommend: keep, nothing sensitive

## Ideas
- Configurable folder/section names in `.env` — value: works with any vault, not just this layout
- English UI strings — value: audience beyond pt-BR

## Done (recent)
- 2026-10-25 — Renamed Vault HQ → Overlook (code and docs; local folder and GitHub repo not yet)
- 2026-10-25 — MIT license chosen (was O1)
- 2026-10-25 — Clone-ready: README with screenshots, `example-vault/`, `PORT`/`ART_DIR` env, Pinterest and services optional (branch `chore/public-ready`)
- 2026-10-24 — Initial dashboard and Pinterest sync (78ed47e)

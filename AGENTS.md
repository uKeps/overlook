# Overlook: rules for agents

## Shipping work

- **Everything goes through a PR**: `main` only takes PRs whose CI (`check`, `conventional-commit`) passed (a GitHub
  ruleset; a direct push is rejected). A branch from `main`, a conventional-commit title, then
  `gh pr merge <n> --auto --squash`, so it merges by itself once CI passes. Keep PRs small and frequent.
- `~/dev/overlook` is where `overlook.service` runs: it stays on `main`. Work in a worktree
  (`git worktree add ../overlook-<name> -b <branch> origin/main`), never by switching that checkout to another branch.

## Trying a change

- Run a second instance on another port (`PORT=3399 bun server.ts`) and test there; the user's instance keeps running.
- Stop it by its job or PID, never with `pkill -f <pattern>`: the pattern also matches any agent whose prompt contains
  it, and kills that agent.
- Never restart `overlook.service` from a canvas terminal: it kills every card, yours included. Ask the user to run
  `systemctl --user restart overlook` from a terminal outside Overlook.
- Changes to `app.js`/`app.css` need only a reload; changes to `server.ts`/`tasks.ts` need the restart.

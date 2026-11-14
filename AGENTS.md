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

## Agents on the canvas

- An agent given a task (by `overlook spawn` or by the user) ends with `overlook done "summary"`: the summary reaches the
  card that gave the task, and the canvas folds the agent's card (title bar, dimmed, with a check). Untouched for 30 min,
  it closes; it stays reopenable from the canvas menu ("Reopen a closed agent", which resumes its conversation).
  Typing in it, a message to it or expanding it keeps it.
- An agent that opened cards closes them with `overlook close <card>` once their work is in (merged or reported).
- Durable context lives in the PR, the commits and ROADMAP.md, not in an agent's conversation: a new task usually goes to
  a fresh agent with a good brief.

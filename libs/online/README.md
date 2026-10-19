# @libs/online

The public online room at `/online`: watch the round being played, join the
queue for the next one, see the ranking. Signing in with a confirmed e-mail is
what lets a player queue.

- `OnlineStore` (provided on the route) mirrors the lobby, ranking, profile and
  connection status. Round frames bypass it and go straight to the arena.
- `ARENA_CONNECTOR` and `ONLINE_ARENA_LAUNCHER` are the seams tests replace.
- Molecules: `account-panel`, `queue-panel`, `ranking-list` — presentational.

The server side and the rules of the room are described in
`.claude/skills/game-server/SKILL.md`. Strings live under `ONLINE` in
`apps/demo-app/src/assets/i18n/{en,pt}.json`.

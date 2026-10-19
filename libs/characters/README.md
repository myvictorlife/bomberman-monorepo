# @libs/characters

The roster: every playable character with its job, its story and its mount,
and a preview that shows the chosen one from each side, standing or walking,
on foot or mounted. Choosing here is what the game uses.

- The catalogue (`CHARACTERS`, `MOUNTS`) lives in `@libs/game-core`, so rules,
  server and clients share one list. The art lives in `@libs/game-client`
  (`characters/cartoon`), and the same painters draw the arena textures.
- The choice lives in `CharacterSelectionService` (`@libs/character-select`),
  a root service the game reads too. `CharactersStore` exposes it through
  `withComputed` and forwards `select()`; it owns only the preview state.
- Sprites are painted through the `CHARACTER_PAINTER` and `MOUNT_ICON_PAINTER`
  tokens, so unit tests swap in fakes — the painters need a 2D canvas.
- Names, jobs and stories are i18n keys: `CHARACTERS.<ID>.{NAME,JOB,STORY}`
  and `MOUNTS.<ID>.{NAME,STORY}`.

Adding a character: an entry in `CHARACTERS` (with its mount), a painter in
`characters/cartoon`, and its keys in both bundles (`en`, `pt`).

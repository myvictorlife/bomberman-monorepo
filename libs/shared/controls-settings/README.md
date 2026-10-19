# @libs/controls-settings

Which hand the player drives with on the keyboard: `wasd` (the default) or
`arrows`. A root service with one signal, persisted in `localStorage`,
following the `ThemeService` pattern. The settings page edits it through
`SettingsStore`, the play page reads it to seat player 1 — and player 2 gets
the other hand. Online both hands always work, so it matters only with two
people on one keyboard.

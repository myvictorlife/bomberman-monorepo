# @libs/character-select

Which character the player has chosen, shared between the roster page (where
it is chosen) and the game (where it is used). A root service with one signal,
persisted in `localStorage`, following the `ThemeService` pattern. Feature
stores read it through `withComputed` and forward writes; they never copy it.

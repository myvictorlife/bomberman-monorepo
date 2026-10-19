# @libs/audio-settings

What the player wants to hear: the arena music (off until they turn it on)
and the sound effects (on until they turn them off). A root service with two
signals, persisted in `localStorage`, following the `ThemeService` pattern.
The settings page and the game page both read it through `withComputed` and
forward writes; neither copies it.

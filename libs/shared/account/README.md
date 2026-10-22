# @libs/account

Signing in and out, shared by every place that offers it: the header's
account menu (wired in the app shell), the profile page and the online room.

- `AccountService` — a root service over the `AUTH` contract: `start()`
  restores the session and reads a returning redirect's failure once;
  `busy`, `error` and `notice` are the state every caller shares.
- `AccountPanelComponent` — the presentational sign-in / sign-up /
  confirm-your-e-mail / signed-in card.

Depends on `@libs/auth`, `@libs/ui` and the translations only — never on a
game library, so a fork without the game keeps it.

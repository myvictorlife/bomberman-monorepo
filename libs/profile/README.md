# profile

Profile feature library. **This is the reference implementation** for a feature lib —
copy its shape when adding a new one. See
[`.claude/skills/feature-lib/SKILL.md`](../../.claude/skills/feature-lib/SKILL.md).

The signed-in player's profile on the game server: the name on the ranking, the
favourite character and the colour. They live in the server's player record, so they
follow the account to any device. Signing in happens on `/online`; this page links there.

**Tag:** `scope:profile` — may depend on auth, character-select, entity, environment,
game-client, game-core, game-protocol, theme, translate and ui.

## Import

```ts
import { profileRoutes, ProfileStore } from '@libs/profile';
```

The app lazy-loads it:

```ts
{ path: 'profile', loadChildren: () => import('@libs/profile').then(m => m.profileRoutes) }
```

## Structure

```
src/lib/
├── +state/profile.store.ts        # signalStore: state, computed, methods
├── molecules/
│   ├── character-picker/          # the roster as portraits, in the player's colour
│   └── color-picker/              # eight swatches + "automatic"
├── pages/
│   ├── profile/                   # route-level component
│   └── user.routes.ts             # provides ProfileStore + ProfileService
└── services/profile/              # GET / PUT {gameServerUrl}/me, bearer ID token
```

## State — `ProfileStore`

A `signalStore` from `@ngrx/signals`. No actions, no reducers, no effects, no selectors.

| Member           | Kind     |                                                      |
| ---------------- | -------- | ---------------------------------------------------- |
| `profile`        | state    | `PlayerProfile \| null` (from `@libs/game-protocol`) |
| `loading`        | state    | `boolean`                                            |
| `error`          | state    | `ProfileFailure \| null` — why loading failed        |
| `saving`         | state    | `boolean`                                            |
| `saveError`      | state    | `ProfileFailure \| null` — e.g. `name-taken`         |
| `hasProfile`     | computed | `profile() !== null`                                 |
| `fetchProfile()` | rxMethod | loads the profile; safe to call repeatedly           |
| `save(update)`   | rxMethod | `PUT /me`; changes go out in order (`concatMap`)     |
| `clear()`        | method   | signed out: forget the last account                  |

A profile with a favourite character also selects it in `CharacterSelectionService`,
so this browser plays with it.

Everything is a signal, so components read it directly — no `select`, no `async` pipe,
nothing to unsubscribe:

```ts
private readonly store = inject(ProfileStore);
readonly profile = this.store.profile;
readonly loading = this.store.loading;
```

### Two decisions worth keeping

**The store is provided on the route, not in root:**

```ts
// user.routes.ts
{ path: '', providers: [ProfileStore, ProfileService], component: Profile }
```

It is created when the feature is entered and torn down when it is left. Providing it
in a component's `imports` array (the old NgModule habit) couples the component to its
own state registration and makes it untestable in isolation.

**`fetchProfile` uses `switchMap` + `tapResponse`:**

- `switchMap` cancels an in-flight request when a newer one starts, so a slow response
  can never overwrite a fresher one.
- `tapResponse` keeps the stream alive after a failure. Without it the first error
  completes the `rxMethod` and **every later call is silently ignored** — which is
  exactly what breaks a retry button.

## Service

`ProfileService` calls `GET` / `PUT {gameServerUrl}/me` with
`Authorization: Bearer <Firebase ID token>`, and fails with a `ProfileFailure` code
(the server's `ProfileUpdateError`, or `network`), never a raw HTTP error. The server
origin comes from the `PROFILE_SERVER_URL` token, which defaults to
`environment.gameServerUrl`; `available` is `false` without a server or a way to sign
in, and the page then says profiles are unavailable instead of failing.

## Testing

The route provides the store, so a component-level test must register it explicitly:

```ts
providers: [
  { provide: AUTH, useValue: fakeAuth },
  { provide: ProfileService, useValue: profileServiceStub },
  ProfileStore,
  provideTranslateService({ lang: 'en' }),
];
```

No root store and no effects runner — that is the point of the SignalStore pattern.
`profile.spec.ts` covers unavailable, signed-out, loading, error, retry and every save.

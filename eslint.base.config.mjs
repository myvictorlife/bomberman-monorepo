import nx from '@nx/eslint-plugin';

/**
 * Every project's eslint.config.mjs extends THIS file, not the root
 * eslint.config.mjs. Dependency rules therefore have to live here — kept in the
 * root config they never run for any project, which is how `scope:` tags drifted
 * out of sync without anyone noticing.
 *
 * Each entry mirrors what the library is actually allowed to reach. Importing
 * something not listed is a lint error, which is the point.
 */
const depConstraints = [
  // Leaf libraries: no workspace dependencies at all.
  { sourceTag: 'scope:entity-lib', onlyDependOnLibsWithTags: [] },
  { sourceTag: 'scope:environment-lib', onlyDependOnLibsWithTags: [] },
  // Design tokens + ThemeService. Consumed by everything, depends on nothing.
  { sourceTag: 'scope:theme-lib', onlyDependOnLibsWithTags: [] },
  // The ANALYTICS contract. A leaf so that depending on analytics never drags a
  // vendor SDK along — only `scope:analytics-firebase-lib` may name Firebase.
  { sourceTag: 'scope:analytics-lib', onlyDependOnLibsWithTags: [] },

  // The AUTH contract: e-mail accounts with no vendor type in sight.
  { sourceTag: 'scope:auth-lib', onlyDependOnLibsWithTags: [] },
  // Only this lib may name Firebase Authentication; only the app imports it.
  {
    sourceTag: 'scope:auth-firebase-lib',
    onlyDependOnLibsWithTags: ['scope:auth-lib', 'scope:environment-lib'],
  },
  {
    sourceTag: 'scope:analytics-firebase-lib',
    onlyDependOnLibsWithTags: ['scope:analytics-lib', 'scope:environment-lib'],
  },
  {
    sourceTag: 'scope:translate',
    onlyDependOnLibsWithTags: ['scope:entity-lib', 'scope:environment-lib'],
  },
  {
    sourceTag: 'scope:profile',
    onlyDependOnLibsWithTags: [
      'scope:auth-lib',
      'scope:character-select-lib',
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:game-client-lib',
      'scope:game-core-lib',
      'scope:game-protocol-lib',
      'scope:theme-lib',
      'scope:translate',
      'scope:ui-lib',
    ],
  },
  // A second feature lib, wider than profile on purpose: it consumes shared UI and
  // the theme/i18n services, which is what a feature reaching for cross-cutting
  // state actually looks like. Note it still cannot see `scope:profile` — features
  // compose through the app, never through each other.
  {
    sourceTag: 'scope:settings',
    onlyDependOnLibsWithTags: [
      'scope:audio-settings-lib',
      'scope:controls-settings-lib',
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:theme-lib',
      'scope:translate',
      'scope:ui-lib',
    ],
  },
  {
    sourceTag: 'scope:ui-lib',
    onlyDependOnLibsWithTags: [
      'scope:analytics-lib',
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:theme-lib',
      'scope:translate',
    ],
  },

  // The game rules: pure TypeScript, no Angular, no Phaser — the same code runs
  // on the game server, so it may depend on nothing at all.
  { sourceTag: 'scope:game-core-lib', onlyDependOnLibsWithTags: [] },
  // The bots: pure TypeScript over the rules, so the browser (offline) and the
  // game server (filling seats online) run the same brains.
  {
    sourceTag: 'scope:game-ai-lib',
    onlyDependOnLibsWithTags: ['scope:game-core-lib'],
  },
  // Phaser rendering, input and skins. Knows the rules, never Angular features.
  {
    sourceTag: 'scope:game-client-lib',
    onlyDependOnLibsWithTags: [
      'scope:game-ai-lib',
      'scope:game-core-lib',
      'scope:game-protocol-lib',
    ],
  },
  // The wire contract between the game server and the browser. Plain data and
  // validators over the rules' types; imported by both sides.
  {
    sourceTag: 'scope:game-protocol-lib',
    onlyDependOnLibsWithTags: ['scope:game-core-lib'],
  },
  // A room's queue, countdown and player records: pure logic the server runs.
  {
    sourceTag: 'scope:game-lobby-lib',
    onlyDependOnLibsWithTags: [
      'scope:game-core-lib',
      'scope:game-protocol-lib',
    ],
  },
  // The Node game server. Never pulls browser code: no Angular, no Phaser, no
  // Firebase web SDK — ID tokens are checked against Google's public keys.
  {
    sourceTag: 'scope:game-server',
    onlyDependOnLibsWithTags: [
      'scope:game-ai-lib',
      'scope:game-core-lib',
      'scope:game-lobby-lib',
      'scope:game-protocol-lib',
    ],
    bannedExternalImports: [
      '@angular/*',
      'phaser',
      'firebase',
      'firebase/*',
      '@colyseus/sdk',
    ],
  },

  // Music and effects on/off: shared between settings and the game.
  { sourceTag: 'scope:audio-settings-lib', onlyDependOnLibsWithTags: [] },
  // Which hand drives on the keyboard: a root service, no dependencies.
  { sourceTag: 'scope:controls-settings-lib', onlyDependOnLibsWithTags: [] },

  // The chosen character: shared between the roster and the game, which never
  // import each other. Knows the roster, nothing else.
  {
    sourceTag: 'scope:character-select-lib',
    onlyDependOnLibsWithTags: ['scope:game-core-lib'],
  },

  // Workspace tooling (generators). Depends on nothing in the workspace.
  { sourceTag: 'scope:tooling', onlyDependOnLibsWithTags: [] },

  {
    sourceTag: 'scope:play',
    onlyDependOnLibsWithTags: [
      'scope:audio-settings-lib',
      'scope:controls-settings-lib',
      'scope:character-select-lib',
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:game-ai-lib',
      'scope:game-client-lib',
      'scope:game-core-lib',
      'scope:theme-lib',
      'scope:translate',
      'scope:ui-lib',
    ],
  },

  {
    sourceTag: 'scope:characters',
    onlyDependOnLibsWithTags: [
      'scope:character-select-lib',
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:game-client-lib',
      'scope:game-core-lib',
      'scope:theme-lib',
      'scope:translate',
      'scope:ui-lib',
    ],
  },

  {
    sourceTag: 'scope:arenas',
    onlyDependOnLibsWithTags: [
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:game-client-lib',
      'scope:game-core-lib',
      'scope:theme-lib',
      'scope:translate',
      'scope:ui-lib',
    ],
  },

  {
    sourceTag: 'scope:items',
    onlyDependOnLibsWithTags: [
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:game-client-lib',
      'scope:game-core-lib',
      'scope:theme-lib',
      'scope:translate',
      'scope:ui-lib',
    ],
  },

  {
    sourceTag: 'scope:sounds',
    onlyDependOnLibsWithTags: [
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:game-client-lib',
      'scope:game-core-lib',
      'scope:theme-lib',
      'scope:translate',
      'scope:ui-lib',
    ],
  },

  {
    sourceTag: 'scope:online',
    onlyDependOnLibsWithTags: [
      'scope:audio-settings-lib',
      'scope:controls-settings-lib',
      'scope:auth-lib',
      'scope:character-select-lib',
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:game-client-lib',
      'scope:game-core-lib',
      'scope:game-protocol-lib',
      'scope:theme-lib',
      'scope:translate',
      'scope:ui-lib',
    ],
  },

  {
    sourceTag: 'scope:mounts',
    onlyDependOnLibsWithTags: [
      'scope:character-select-lib',
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:game-client-lib',
      'scope:game-core-lib',
      'scope:theme-lib',
      'scope:translate',
      'scope:ui-lib',
    ],
  },

  // <feature-scopes> — the feature-lib generator inserts new feature entries
  // above this line. Keep the marker.

  // The application composes everything. It is also the only project allowed to
  // reach `scope:analytics-firebase-lib` — choosing a vendor is a composition
  // decision, so it happens once, in app.config.ts.
  {
    sourceTag: 'scope:demo-app',
    onlyDependOnLibsWithTags: [
      'scope:analytics-lib',
      'scope:analytics-firebase-lib',
      'scope:auth-lib',
      'scope:auth-firebase-lib',
      'scope:audio-settings-lib',
      'scope:controls-settings-lib',
      'scope:character-select-lib',
      'scope:entity-lib',
      'scope:environment-lib',
      'scope:profile',
      'scope:settings',
      'scope:theme-lib',
      'scope:translate',
      'scope:ui-lib',
      // The title screen paints stills of the arena with the game's own skin.
      'scope:game-client-lib',
      'scope:game-core-lib',
      // The account's favourite character is kept in step from here (`ProfileSyncService`).
      'scope:game-protocol-lib',
      'scope:play',
      'scope:characters',
      'scope:arenas',
      'scope:items',
      'scope:sounds',
      'scope:online',
      'scope:mounts',
      // <demo-app-feature-scopes> — the feature-lib generator inserts new
      // scopes above this line. Keep the marker.
    ],
  },
];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allowCircularSelfDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints,
        },
      ],
    },
  },
];

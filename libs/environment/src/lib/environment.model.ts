export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

/**
 * Where this deployment's source lives. Comes from `config/site.json` or the
 * `SITE_REPO_URL` env var — never committed, so a fork's build links to its own
 * repository or to nothing, not to the template's.
 */
export interface SiteConfig {
  repoUrl: string;
}

/**
 * Where the multiplayer game server listens, e.g. `https://game.example.com`.
 * Comes from `config/game-server.json` or `GAME_SERVER_URL`.
 */
export interface GameServerConfig {
  url: string;
}

/** The game server's port in development, matching `DEFAULT_GAME_SERVER_PORT`. */
export const LOCAL_GAME_SERVER_URL = 'http://localhost:8086';

/**
 * Shape every environment file must satisfy. Typing them all against this stops
 * the variants from drifting apart — a missing key is now a compile error in the
 * configuration that uses it, not a surprise at build time.
 */
export interface Environment {
  production: boolean;
  environmentName: string;
  baseUrl: string;
  firebaseEnabled: boolean;
  firebaseConfig: FirebaseConfig;
  /** `null` when no repo URL is configured — every "view source" link stays unrendered. */
  repoUrl: string | null;
  /**
   * E-mail sign-in, which needs a Firebase project. Separate from
   * `firebaseEnabled` because that one also drives analytics, which the
   * `local` configuration keeps off on purpose.
   */
  authEnabled: boolean;
  /** `null` hides the online room: there is no game server to connect to. */
  gameServerUrl: string | null;
  /** Hash of the i18n bundles, appended to their URL so a stale cached copy is never used. */
  i18nVersion: string;
}

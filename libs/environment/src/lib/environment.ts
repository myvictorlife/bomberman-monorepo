import { Environment } from './environment.model';
import { firebaseConfig, firebaseEnabled } from './generated/firebase.config';
import {
  gameServerConfig,
  gameServerEnabled,
} from './generated/game-server.config';
import { i18nVersion } from './generated/i18n-version';
import { siteConfig, siteLinksEnabled } from './generated/site.config';

export const environment: Environment = {
  production: true,
  environmentName: 'Production',
  baseUrl: 'http://localhost:8080',
  // Both come from `config/firebase.json` — see `config/README.md`.
  firebaseEnabled,
  firebaseConfig,
  // From `config/site.json` / `SITE_REPO_URL`; absent means no source links.
  repoUrl: siteLinksEnabled ? siteConfig.repoUrl : null,
  // Sign-in works wherever a Firebase project is configured.
  authEnabled: firebaseEnabled,
  // From `config/game-server.json` / `GAME_SERVER_URL`; absent hides the online room.
  gameServerUrl: gameServerEnabled ? gameServerConfig.url : null,
  i18nVersion,
};

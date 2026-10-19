import { Environment, LOCAL_GAME_SERVER_URL } from './environment.model';
import { firebaseConfig, firebaseEnabled } from './generated/firebase.config';
import {
  gameServerConfig,
  gameServerEnabled,
} from './generated/game-server.config';
import { i18nVersion } from './generated/i18n-version';
import { siteConfig, siteLinksEnabled } from './generated/site.config';

export const environment: Environment = {
  production: false,
  environmentName: 'Local',
  baseUrl: 'http://localhost:8080',
  /**
   * Hardcoded `false`, unlike the other two variants: the `local` configuration
   * exists to run the app in isolation, and analytics from a developer machine
   * would pollute the project's real metrics. Flip it here if you need to debug
   * event logging.
   */
  firebaseEnabled: false,
  firebaseConfig,
  // Unlike analytics there is no reason to force this off locally: the link is
  // inert and seeing it is how you check it renders.
  repoUrl: siteLinksEnabled ? siteConfig.repoUrl : null,
  // Sign-in works wherever a Firebase project is configured.
  authEnabled: firebaseEnabled,
  // From `config/game-server.json` / `GAME_SERVER_URL`; absent means the local server.
  gameServerUrl: gameServerEnabled
    ? gameServerConfig.url
    : LOCAL_GAME_SERVER_URL,
  i18nVersion,
};

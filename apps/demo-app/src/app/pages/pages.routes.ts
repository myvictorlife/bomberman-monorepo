import { Routes } from '@angular/router';
import { HomePage } from './home/home';
import { DesignPage } from './design/design';
import { NotFoundPage } from './not-found/not-found';

export const appPagesRoutes: Routes = [
  {
    path: '',
    title: 'HOME.TITLE',
    component: HomePage,
  },
  {
    path: 'play',
    title: 'PLAY.TITLE',
    loadChildren: () => import('@libs/play').then((m) => m.playRoutes),
  },
  {
    path: 'online',
    title: 'ONLINE.TITLE',
    loadChildren: () => import('@libs/online').then((m) => m.onlineRoutes),
  },
  {
    path: 'characters',
    title: 'CHARACTERS.TITLE',
    loadChildren: () =>
      import('@libs/characters').then((m) => m.charactersRoutes),
  },
  {
    path: 'mounts',
    title: 'MOUNTS.TITLE',
    loadChildren: () => import('@libs/mounts').then((m) => m.mountsRoutes),
  },
  {
    path: 'arenas',
    title: 'ARENAS.TITLE',
    loadChildren: () => import('@libs/arenas').then((m) => m.arenasRoutes),
  },
  {
    path: 'items',
    title: 'ITEMS.TITLE',
    loadChildren: () => import('@libs/items').then((m) => m.itemsRoutes),
  },
  // Audio is a part of the settings: listening to every sound and picking the
  // announcer's voice. Two features, composed here — neither imports the other.
  {
    path: 'settings/audio',
    title: 'SOUNDS.TITLE',
    loadChildren: () => import('@libs/sounds').then((m) => m.soundsRoutes),
  },
  { path: 'sounds', redirectTo: 'settings/audio', pathMatch: 'full' },
  {
    path: 'profile',
    title: 'PROFILE.TITLE',
    loadChildren: () => import('@libs/profile').then((m) => m.profileRoutes),
  },
  {
    path: 'settings',
    title: 'SETTINGS.TITLE',
    loadChildren: () => import('@libs/settings').then((m) => m.settingsRoutes),
  },
  {
    path: 'design',
    title: 'DESIGN.TITLE',
    component: DesignPage,
  },
  {
    path: '**',
    title: 'NOT_FOUND.TITLE',
    component: NotFoundPage,
  },
];

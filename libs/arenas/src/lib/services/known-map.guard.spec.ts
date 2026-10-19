import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { knownMapGuard } from './known-map.guard';

describe('knownMapGuard', () => {
  const run = (id: string | null) =>
    TestBed.runInInjectionContext(() =>
      knownMapGuard(
        {
          paramMap: convertToParamMap(id === null ? {} : { id }),
        } as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([])] }),
  );

  it('lets a known arena through', () => {
    expect(run('autodromo')).toBe(true);
  });

  it('sends an unknown or missing id back to the gallery', () => {
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(run('lua') as UrlTree)).toBe('/arenas');
    expect(router.serializeUrl(run(null) as UrlTree)).toBe('/arenas');
  });
});

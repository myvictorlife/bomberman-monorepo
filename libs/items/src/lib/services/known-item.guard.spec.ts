import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { knownItemGuard } from './known-item.guard';

describe('knownItemGuard', () => {
  const run = (id: string) =>
    TestBed.runInInjectionContext(() =>
      knownItemGuard(
        { paramMap: convertToParamMap({ id }) } as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );

  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([])] }),
  );

  it('lets a known item through and sends the rest to the gallery', () => {
    expect(run('egg')).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(run('sword') as UrlTree)).toBe(
      '/items',
    );
  });
});

import { TestBed } from '@angular/core/testing';
import {
  CONTROLS_STORAGE_KEY,
  ControlsSettingsService,
  isKeyScheme,
} from './controls-settings.service';

describe('ControlsSettingsService', () => {
  const service = () => TestBed.inject(ControlsSettingsService);

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => vi.restoreAllMocks());

  it('drives with the letters until told otherwise, the arrows left for a second player', () => {
    expect(service().scheme()).toBe('wasd');
    expect(service().other()).toBe('arrows');
  });

  it('switches hands and remembers it', () => {
    service().setScheme('arrows');
    TestBed.tick();
    expect(service().other()).toBe('wasd');
    expect(JSON.parse(localStorage.getItem(CONTROLS_STORAGE_KEY)!)).toEqual({
      scheme: 'arrows',
    });
  });

  it('restores the remembered hand', () => {
    localStorage.setItem(
      CONTROLS_STORAGE_KEY,
      JSON.stringify({ scheme: 'arrows' }),
    );
    expect(service().scheme()).toBe('arrows');
  });

  it('falls back to the letters on anything it does not recognise', () => {
    localStorage.setItem(
      CONTROLS_STORAGE_KEY,
      JSON.stringify({ scheme: 'joystick' }),
    );
    expect(service().scheme()).toBe('wasd');
    localStorage.setItem(CONTROLS_STORAGE_KEY, 'not json');
    TestBed.resetTestingModule();
    expect(service().scheme()).toBe('wasd');
    localStorage.setItem(CONTROLS_STORAGE_KEY, '42');
    TestBed.resetTestingModule();
    expect(service().scheme()).toBe('wasd');
  });

  it('keeps working when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(service().scheme()).toBe('wasd');
    service().setScheme('arrows');
    TestBed.tick();
    expect(service().scheme()).toBe('arrows');
  });

  it('knows the two hands', () => {
    expect(isKeyScheme('wasd')).toBe(true);
    expect(isKeyScheme('arrows')).toBe(true);
    expect(isKeyScheme('mouse')).toBe(false);
  });
});

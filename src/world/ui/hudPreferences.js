export const HUD_PREFERENCES_KEY = 'ego-world-hud-preferences-v1';

export const DEFAULT_HUD_PREFERENCES = Object.freeze({
  hudScale: 1,
  highContrast: false,
  reducedMotion: false,
});

export function normalizeHudPreferences(value) {
  const input = value && typeof value === 'object' ? value : {};
  const scale = Number(input.hudScale);
  return {
    hudScale: Number.isFinite(scale) ? Math.max(0.8, Math.min(1.4, Math.round(scale * 20) / 20)) : 1,
    highContrast: input.highContrast === true,
    reducedMotion: input.reducedMotion === true,
  };
}

export function readHudPreferences(storage) {
  try {
    const source = storage === undefined ? globalThis.localStorage : storage;
    return normalizeHudPreferences(JSON.parse(source?.getItem(HUD_PREFERENCES_KEY) || 'null'));
  } catch {
    return { ...DEFAULT_HUD_PREFERENCES };
  }
}

export function writeHudPreferences(value, storage) {
  const preferences = normalizeHudPreferences(value);
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(HUD_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch { /* private storage may be unavailable */ }
  return preferences;
}

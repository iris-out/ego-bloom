// Theme registry: maps theme id -> icon component.
// Each theme component shares the signature ({ tier, size, rank, animate, className }).
// Two families × 4 variations (simple → ornate).
import { THEME_META } from './themeMeta';
import {
  ConstellationMinimal,
  ConstellationBalanced,
  ConstellationGlow,
  ConstellationOrnate,
} from './constellationVariants';
import {
  CelestialMinimal,
  CelestialBalanced,
  CelestialGlow,
  CelestialOrnate,
} from './celestialVariants';

const COMPONENTS = {
  'constellation-min': ConstellationMinimal,
  'constellation-balance': ConstellationBalanced,
  'constellation-glow': ConstellationGlow,
  'constellation-ornate': ConstellationOrnate,
  'celestial-min': CelestialMinimal,
  'celestial-balance': CelestialBalanced,
  'celestial-glow': CelestialGlow,
  'celestial-ornate': CelestialOrnate,
};

export const THEMES = THEME_META.map((m) => ({ ...m, Component: COMPONENTS[m.id] }));

export function getThemeComponent(id) {
  return COMPONENTS[id] || null;
}

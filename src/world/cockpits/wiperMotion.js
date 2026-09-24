/** Canvas simulation time freezes with single-player pause and has no resume jump. */
export function wiperPhase(weather, elapsedTime) {
  return weather === 'rain' && Number.isFinite(elapsedTime) ? (elapsedTime / 1.4) % 1 : 0;
}

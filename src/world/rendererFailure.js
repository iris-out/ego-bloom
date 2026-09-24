import { _roots } from '@react-three/fiber';

/** R3F 9 initializes gl before scene and children. Its async configure errors are
 * outside Canvas's React boundary, and dispose(null) prevents registry cleanup.
 * Only discard a failed root that has never acquired GL, scene, or active work.
 * Recheck this exported registry contract when upgrading R3F. */
export function discardUnconfiguredRoot(canvas) {
  const root = _roots.get(canvas);
  const state = root?.store.getState();
  if (!state || state.gl !== null || state.scene !== null || state.internal.active) return false;
  return _roots.delete(canvas);
}

// Shared materials can be visited by several model instances. Restore their
// original finish only when the last owner releases it; never revive a texture
// owned by an already-unmounted model or renderer.
const owners = new WeakMap();
export function retainMaterialEnvironment(material, texture, intensity = .55) {
  let entry = owners.get(material);
  if (!entry) {
    entry = { original: { texture: material.envMap, intensity: material.envMapIntensity }, leases: [] };
    owners.set(material, entry);
  }
  const lease = { texture, intensity };
  entry.leases.push(lease);
  const apply = value => {
    material.envMap = value.texture;
    material.envMapIntensity = value.intensity;
    material.needsUpdate = true;
  };
  apply(lease);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.leases.splice(entry.leases.indexOf(lease), 1);
    apply(entry.leases.at(-1) || entry.original);
    if (!entry.leases.length) owners.delete(material);
  };
}

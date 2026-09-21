import { MODELS_PER_TIER, variantCountOf } from './models/tierBuildings.js';
/** Explicit model_variant wins when it is a valid index for that tier's model count.
 * Otherwise the id hashes deterministically into one of that tier's models.
 * Tiers can carry different numbers of variants (see variantCountOf); MODELS_PER_TIER
 * is only the fallback count for a tier name that has no models at all.
 */
export function modelVariant(building) {
  const count = variantCountOf(building?.tier_name) || MODELS_PER_TIER;
  if (Number.isInteger(building.model_variant) && building.model_variant >= 0 && building.model_variant < count) {
    return building.model_variant;
  }
  let hash = 0;
  for (const c of String(building.id || '')) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return hash % count;
}
export { BUILDING_NAMES as VARIANT_NAMES } from './models/tierBuildings.js';

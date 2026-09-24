import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
export function useSurfaceMaterial(properties) {
  const signature=JSON.stringify(properties);
  const material=useMemo(()=>new THREE.MeshStandardMaterial(JSON.parse(signature)),[signature]);
  useEffect(()=>()=>material.dispose(),[material]);
  return material;
}

/** Firing counters are authoritative. Recoil/flash never advance during pause. */
export function helicopterGunPulse(previous, shots, delta, index) {
  const count=Math.max(0,Number(shots)||0), step=Math.max(0,Math.min(Number(delta)||0,.05));
  if(step===0)return previous;
  const added=count-previous.shots;
  const fired=added>0&&(added>=2||previous.shots%2===index);
  return {shots:count,remaining:fired?.055:Math.max(0,previous.remaining-step)};
}

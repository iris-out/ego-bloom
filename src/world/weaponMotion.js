/** Pure, frame-rate independent targets for the first-person weapon model.
 * The walk simulation supplies recoil/reload progress; this module only turns
 * those live values into small, bounded mechanical motions. */
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const bell = (value) => {
  const progress = clamp01(value);
  return progress === 0 || progress === 1 ? 0 : Math.sin(progress * Math.PI);
};

export function actionPose(weapon, recoil = 0) {
  const kick = clamp01(recoil);
  const automatic = weapon === 'pistol' || weapon === 'smg';
  return {
    kick,
    slide: automatic ? kick * (weapon === 'pistol' ? 0.052 : 0.036) : 0,
    bolt: weapon === 'sniper' ? kick * 0.065 : 0,
    // 펌프액션은 슬라이드나 볼트 대신 포어엔드가 뒤로 빠졌다 돌아오는 pump 값을 쓴다.
    pump: weapon === 'shotgun' ? kick * 0.14 : 0,
    // The recoil value decays in the simulation, making the flash a brief
    // event rather than a permanently glowing muzzle.
    flash: clamp01((kick - 0.12) / 0.34),
  };
}

export function reloadPose(weapon, progress = 0) {
  const dip = bell(progress);
  return {
    dip,
    magazine: dip,
    magazineTravel: dip * (weapon === 'smg' ? 0.13 : weapon === 'shotgun' ? 0.05 : 0.10),
    bolt: weapon === 'sniper' ? dip * 0.12 : dip * 0.018,
  };
}

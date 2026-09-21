/** 거울 패스와 그림자 caster 재구성이 같은 프레임에 몰리지 않게 프레임 번호로 갈라 놓는다.
 * 두 판정은 three 와 React 에 기대지 않아 단위 테스트가 번호만 넣는다. */
import { MIRROR_PASS } from './cockpits/mirrorLayout.js';

const EVERY = [...new Set(Object.values(MIRROR_PASS).map((pass) => Math.max(1, Math.round(pass.every))))];

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** 모든 품질의 거울 주기가 한 번씩 도는 길이다. 이 안에서 어느 품질의 거울 프레임도 아닌 자리를 고른다. */
const PERIOD = EVERY.reduce((lcm, every) => (lcm * every) / gcd(lcm, every), 1);
const FREE = new Uint8Array(PERIOD);
for (let i = 0; i < PERIOD; i += 1) FREE[i] = EVERY.every((every) => i % every !== 0) ? 1 : 0;

export function shouldRenderMirror(frameIndex, pass) {
  const every = Math.max(1, Math.round(pass?.every || 1));
  const index = Math.floor(frameIndex);
  return (((index % every) + every) % every) === 0;
}

export function shouldRebuildCasters(frameIndex) {
  const index = Math.floor(frameIndex);
  return FREE[((index % PERIOD) + PERIOD) % PERIOD] === 1;
}

/** 거울과 caster 가 같은 번호를 봐야 서로 어긋날 수 있다. 시각이 바뀐 첫 호출에서만 올린다. */
let index = 0, stamp = NaN;
export function worldFrame(time) {
  if (time !== stamp) { stamp = time; index += 1; }
  return index;
}

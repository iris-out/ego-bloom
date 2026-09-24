/** 선택 카드의 실루엣이다. 3D 모델이 아니라 카드용 2D 표식이므로 단색 path 만 쓴다.
 * 색은 currentColor 로 두고 CSS 가 정한다. 좌표계는 viewBox 44x18 로 통일한다. */

const box = { viewBox: '0 0 44 18', fill: 'currentColor', 'aria-hidden': 'true' };

const Jet = () => <svg {...box}>
  <ellipse cx="22" cy="9" rx="13" ry="2.4" />
  <path d="M20 8 L5 3 L5 5.2 L20 10 Z" /><path d="M24 8 L39 3 L39 5.2 L24 10 Z" />
  <path d="M32 9 L37 5 L38 9 Z" />
  <rect x="16" y="10.6" width="2" height="2.4" /><rect x="26" y="10.6" width="2" height="2.4" />
</svg>;

/* 폭격기. 넓은 주익에 엔진 네 개, 동체 아래 열린 폭탄창이다. */
const Bomber = () => <svg {...box}>
  <ellipse cx="22" cy="8" rx="17" ry="2.6" />
  <path d="M20 7 L6 3.4 L6 5.4 L20 9 Z" /><path d="M24 7 L38 3.4 L38 5.4 L24 9 Z" />
  <path d="M37 7 L41 2.8 L42 7 Z" />
  <rect x="10" y="4.4" width="3.4" height="2" rx="0.9" /><rect x="15" y="4.4" width="3.4" height="2" rx="0.9" />
  <rect x="25.6" y="4.4" width="3.4" height="2" rx="0.9" /><rect x="30.6" y="4.4" width="3.4" height="2" rx="0.9" />
  <path d="M18 10.4 L18 13.4 L20 12.6 L20 10.4 Z" /><path d="M26 10.4 L26 13.4 L24 12.6 L24 10.4 Z" />
  <circle cx="22" cy="13.6" r="1.5" /><circle cx="22" cy="17" r="1.1" />
</svg>;

/* 프로펠러 전투기. 코의 프로펠러 원판과 타원 주익이다. */
const PropFighter = () => <svg {...box}>
  <ellipse cx="23" cy="9" rx="11" ry="2.2" />
  <ellipse cx="11" cy="9" rx="1.6" ry="7" />
  <rect x="10.2" y="8.2" width="3.4" height="1.6" rx="0.8" />
  <path d="M21 8 L15 4.4 L14 5.6 L21 9.6 Z" /><path d="M21 9.6 L15 13.6 L14 12.4 L21 10 Z" />
  <path d="M25 8 L19 4.4 L18 5.6 L25 9.6 Z" /><path d="M25 9.6 L19 13.6 L18 12.4 L25 10 Z" />
  <path d="M33 8 L37 4.2 L38 8 Z" />
  <rect x="32" y="8.6" width="8" height="1.2" rx="0.6" />
</svg>;

const Fighter = () => <svg {...box}>
  <path d="M22 1 L25.6 9 L25.6 15 L18.4 15 L18.4 9 Z" />
  <path d="M18.4 9.6 L4 12.4 L4 14.4 L18.4 13.2 Z" />
  <path d="M25.6 9.6 L40 12.4 L40 14.4 L25.6 13.2 Z" />
  <rect x="16.4" y="14.4" width="1.8" height="3.4" /><rect x="25.8" y="14.4" width="1.8" height="3.4" />
</svg>;

const Helicopter = () => <svg {...box}>
  <rect x="5" y="3.6" width="34" height="1.4" rx="0.7" />
  <rect x="21" y="5" width="1.8" height="3" />
  <rect x="13" y="8" width="17" height="6.4" rx="3.2" />
  <path d="M30 10 L42 10.6 L42 12 L30 12.4 Z" />
  <rect x="40" y="7.6" width="1.4" height="4.4" rx="0.7" />
  <rect x="15" y="14.8" width="12" height="1.2" rx="0.6" />
</svg>;

const Sedan = () => <svg {...box}>
  <path d="M6 12 L8 8.6 Q10 6.6 15 6.4 L28 6.4 Q33 6.6 36 9 L38 12 Z" />
  <rect x="5" y="11.6" width="34" height="2.6" rx="1.2" />
  <circle cx="13" cy="14.8" r="2.4" /><circle cx="31" cy="14.8" r="2.4" />
</svg>;

/* SUV. 세단보다 높고 각진 캐빈에 지붕 레일을 얹었다. */
const Suv = () => <svg {...box}>
  <path d="M6 12 L7.5 6.4 L12 4.6 L30 4.6 L36 7 L38 12 Z" />
  <rect x="11" y="3.2" width="18" height="1.2" rx="0.6" />
  <rect x="5" y="11.4" width="34" height="3" rx="1.2" />
  <circle cx="13" cy="15" r="2.8" /><circle cx="31" cy="15" r="2.8" />
</svg>;

/* 오픈카. 낮은 차체에 앞유리만 세우고 뒤에 접은 지붕이 있다. */
const Convertible = () => <svg {...box}>
  <path d="M15 10.4 L17 6.8 L22 6.8 L21 10.4 Z" />
  <rect x="27" y="9" width="7" height="2" rx="1" />
  <rect x="5" y="10.4" width="34" height="3.4" rx="1.4" />
  <circle cx="13" cy="14.8" r="2.4" /><circle cx="31" cy="14.8" r="2.4" />
</svg>;

const Coupe = () => <svg {...box}>
  <path d="M5 11.4 L8 8.8 Q10 6.3 16 5.9 Q25 4.8 31 7.2 L37 11.4 Z" />
  <rect x="4" y="11" width="36" height="2.7" rx="1.2" />
  <circle cx="12" cy="14.4" r="2.3" /><circle cx="32" cy="14.4" r="2.3" />
  <path d="M19 6 L18 10.5 M28 7 L29 10.5" stroke="currentColor" strokeWidth=".6" />
</svg>;

const Supercar = () => <svg {...box}>
  <path d="M4 12 L10 10 L16 7.3 L25 6.9 L32 9.8 L40 11.8 Z" />
  <rect x="4" y="11.9" width="36" height="2" rx=".8" />
  <circle cx="12" cy="14.1" r="2.5" /><circle cx="33" cy="14.1" r="2.7" />
  <path d="M27 9.8 L31 10.5 L29 11.3 L25 11.2 Z" fill="none" stroke="currentColor" strokeWidth=".8" />
</svg>;

const Electric = () => <svg {...box}>
  <path d="M4 11.7 L8 9.5 Q11 6.3 17 5.6 L28 5.6 Q34 6 38 11.6 Z" />
  <rect x="4" y="11.6" width="36" height="2.4" rx="1.2" />
  <circle cx="12" cy="14.4" r="2.3" /><circle cx="32" cy="14.4" r="2.3" />
  <path d="M27 5.7 Q34 6.2 38 11.5" fill="none" stroke="currentColor" strokeWidth=".7" />
</svg>;

/* 트럭. 앞의 캡과 뒤의 높은 적재함, 뒷바퀴 두 축이다. */
const Truck = () => <svg {...box}>
  <path d="M4 13 L4 6 L7 3.4 L14 3.4 L14 13 Z" />
  <rect x="15" y="2.4" width="26" height="10.6" rx="0.8" />
  <rect x="3" y="12.6" width="39" height="1.8" rx="0.8" />
  <circle cx="9" cy="15.2" r="2.6" /><circle cx="28" cy="15.2" r="2.6" /><circle cx="35" cy="15.2" r="2.6" />
</svg>;

const Motorcycle = () => <svg {...box}>
  <circle cx="12" cy="13" r="4" /><circle cx="32" cy="13" r="4" />
  <path d="M12 13 L19 8.6 L27 8.6 L32 13 L27 11 L20 11 Z" />
  <rect x="17.6" y="6" width="6.8" height="2.2" rx="1" />
  <rect x="24" y="4.6" width="5.4" height="1.4" rx="0.7" />
</svg>;

const Tank = () => <svg {...box}>
  <rect x="5" y="11" width="34" height="4.6" rx="2.2" />
  <path d="M12 11 L14 8 L30 8 L32 11 Z" />
  <rect x="18" y="5.2" width="10" height="3" rx="1.4" />
  <rect x="27" y="6" width="14" height="1.4" rx="0.7" />
  <circle cx="11" cy="15.6" r="1.5" /><circle cx="18" cy="15.6" r="1.5" />
  <circle cx="26" cy="15.6" r="1.5" /><circle cx="33" cy="15.6" r="1.5" />
</svg>;

const Howitzer = () => <svg {...box}>
  <rect x="6" y="11" width="32" height="4.6" rx="2" />
  <path d="M13 11 L15 7.6 L29 7.6 L31 11 Z" />
  <rect x="18" y="5" width="9" height="2.8" rx="1.2" />
  <path d="M26 6.4 L41 1.6 L42 3 L27 8 Z" />
  <circle cx="12" cy="15.6" r="1.5" /><circle cx="19" cy="15.6" r="1.5" />
  <circle cx="26" cy="15.6" r="1.5" /><circle cx="33" cy="15.6" r="1.5" />
</svg>;

const Armored = () => <svg {...box}>
  <path d="M5 11.4 L7 8 L14 7 L33 7 L38 9.4 L39 11.4 Z" />
  <rect x="5" y="11.4" width="34" height="2.6" rx="1" />
  <rect x="20" y="4.6" width="6" height="2.6" rx="1" />
  <rect x="25" y="5.2" width="11" height="1.1" rx="0.55" />
  <circle cx="11" cy="14.8" r="2.2" /><circle cx="19" cy="14.8" r="2.2" />
  <circle cx="27" cy="14.8" r="2.2" /><circle cx="34" cy="14.8" r="2.2" />
</svg>;

const Walk = () => <svg {...box}>
  <circle cx="22" cy="3.6" r="2.4" />
  <path d="M21 6.4 L23 6.4 L23.6 10.4 L20.4 10.4 Z" />
  <path d="M20.4 10.4 L18 16.8 L19.8 17.4 L22 12.4 L24.2 17.4 L26 16.8 L23.6 10.4 Z" />
  <path d="M20.8 7.4 L16.4 9.6 L17.2 11 L21.2 9.2 Z" />
  <path d="M23.2 7.4 L28.4 8.4 L28.2 10 L23 9.2 Z" />
</svg>;

/* 요격기. Me 262 처럼 젖힌 주익과 날개 밑 나셀 두 개다. */
const Interceptor = () => <svg {...box}>
  <path d="M22 1.6 L24.4 8 L24.4 15.4 L19.6 15.4 L19.6 8 Z" />
  <path d="M19.6 7.6 L6 12 L6 13.6 L19.6 11.4 Z" />
  <path d="M24.4 7.6 L38 12 L38 13.6 L24.4 11.4 Z" />
  <rect x="12.6" y="9.6" width="4.6" height="2.2" rx="1.1" />
  <rect x="26.8" y="9.6" width="4.6" height="2.2" rx="1.1" />
  <path d="M20.6 15.4 L18.6 17.6 L25.4 17.6 L23.4 15.4 Z" />
</svg>;

/* 대공포. 차륜 차대 위에 쌍열 포신을 비스듬히 세워 올린 실루엣이다. */
const AntiAir = () => <svg {...box}>
  <rect x="6" y="13.6" width="32" height="4.2" rx="1.2" />
  <rect x="15" y="9.8" width="14" height="4.2" rx="1" />
  <path d="M23 10.4 L34.6 3.2 L35.8 4.8 L24.2 12 Z" />
  <path d="M21.4 10.4 L33 3.2 L34.2 4.8 L22.6 12 Z" />
  <circle cx="12" cy="18.6" r="2.6" />
  <circle cx="19.2" cy="18.6" r="2.6" />
  <circle cx="26.4" cy="18.6" r="2.6" />
  <circle cx="33.6" cy="18.6" r="2.6" />
</svg>;

/* 현대식 포뮬러. 넓은 윙과 노출 바퀴, 좁은 모노코크가 위에서 보인다. */
const Formula = () => <svg {...box}>
  <rect x="4" y="4.5" width="36" height="2.5" rx=".8" />
  <rect x="6" y="17" width="32" height="3" rx=".8" />
  <path d="M20.5 3 L23.5 3 L25 10 L28 12 L27 17 L17 17 L16 12 L19 10 Z" />
  <path d="M18 8 L11 10 L10 15 L17 14 Z M26 8 L33 10 L34 15 L27 14 Z" />
  <circle cx="9" cy="8.5" r="3" /><circle cx="35" cy="8.5" r="3" />
  <circle cx="10" cy="16" r="3.2" /><circle cx="34" cy="16" r="3.2" />
  <path d="M19 9.5 Q22 6.5 25 9.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
</svg>;

const Airship = () => <svg {...box}>
  <ellipse cx="21" cy="7" rx="17" ry="6"/><path d="M33 5 L40 1 L39 7 L42 12 L32 10 Z"/>
  <rect x="15" y="12" width="12" height="4" rx="1.5"/>
</svg>;
const Drift = () => <svg {...box}>
  <path d="M14 10 L17 6 L22 6 L21 10 Z M5 10 L37 10 L39 14 L4 14 Z"/>
  <path d="M30 6 H42 V8 H30 Z M34 8 H36 V11 H34 Z"/>
  <circle cx="12" cy="15" r="2.7"/><circle cx="32" cy="15" r="2.7"/>
</svg>;
const RIDE_ART = {
  drift: Drift, airship: Airship,
  jet: Jet, fighter: Fighter, prop: PropFighter, interceptor: Interceptor, shotgun: Interceptor, bomber: Bomber, helicopter: Helicopter,
  sedan: Sedan, motorcycle: Motorcycle, suv: Suv, convertible: Convertible, coupe: Coupe,
  supercar: Supercar, electric: Electric, formula: Formula, truck: Truck,
  tank: Tank, howitzer: Howitzer, armored: Armored, aa: AntiAir,
  walk: Walk,
};

export default function RideArt({ rideKey }) {
  const Art = RIDE_ART[rideKey];
  return Art ? <span className="wui-ride-art"><Art /></span> : <span className="wui-ride-art" aria-hidden="true" />;
}

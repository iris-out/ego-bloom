/** 처치 기록 한 줄이다. 도보와 전투 차량이 같은 표시를 쓴다.
 * 처치 수를 key 로 걸어 새 줄이 마운트될 때마다 한 번 떴다 사라진다.
 * 수명은 CSS 애니메이션이 맡는다. 타이머를 두지 않는다. */
export default function KillFeed({ kills = 0, weapon = '', label = '차량', verb = '파괴' }) {
  if (!kills) return null;
  return <p key={kills} className="wui-fps-feed" aria-live="polite">
    {weapon && <b>{weapon}</b>}{label || '차량'} {verb}<i>{kills}</i>
  </p>;
}

import { TABS_PER_ORIGIN } from '../multiplayer';

/** 같은 회선에서 탭을 너무 많이 연 경우다. 뒤에 열린 탭에만 뜨고 화면 전체를 막는다.
 * 접속 자체를 끊지는 않는다. 다른 탭을 닫으면 순서가 다시 매겨져 저절로 사라진다.
 */
export default function TabLimitModal() {
  return <div className="wui-block" role="dialog" aria-modal="true" aria-labelledby="wui-block-title">
    <div className="wui-block-card">
      <h2 id="wui-block-title">연결이 너무 많습니다</h2>
      <p>한 회선에서는 에고 시티를 최대 {TABS_PER_ORIGIN}개 탭까지 열 수 있다. 먼저 열어 둔 탭을 닫으면 이 화면이 사라진다.</p>
    </div>
  </div>;
}

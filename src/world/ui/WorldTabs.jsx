import { ArrowLeft } from 'lucide-react';
import { WORLD_TABS } from './worldTabs.js';
import './worldSurface.css';

/** 상단 탭바다. 배경판 없이 비네팅 위에 올라가므로 도시가 화면 맨 위까지 이어진다.
 * 760px 미만에서는 CSS 가 선택되지 않은 탭의 글자를 숨긴다. aria-label 은 남는다. */
const CONNECTION_LABEL = { single: '싱글 플레이', idle: '시작 메뉴', connecting: '연결 중…', unavailable: '실시간 미설정' };

function connectionText(connection, count) {
  if (connection === 'connected') return `접속 ${count ?? 0}`;
  return CONNECTION_LABEL[connection] || '재연결 중…';
}

export default function WorldTabs({ active, onChange, onHome, connection, count }) {
  return <nav className="wui-tabs" role="tablist" aria-label="월드 도구">
    <button type="button" className="wui-tab" aria-label="게임 메뉴 열기" onClick={onHome}>
      <ArrowLeft size={17} aria-hidden="true" />
    </button>
    {WORLD_TABS.map((tab) => <button type="button" key={tab.key} className="wui-tab"
      role="tab" aria-selected={active === tab.key} aria-label={tab.ko}
      onClick={() => onChange(active === tab.key ? null : tab.key)}>
      <tab.Icon size={16} aria-hidden="true" />
      <span className="wui-tab-label">{tab.ko}</span>
    </button>)}
    <span className="wui-tabs-spacer" />
    <span className="wui-tabs-end" role="status" data-connection={connection}
      title="현재 오픈월드를 열고 있는 접속 세션 수다. 여러 탭은 각각 집계된다.">
      <i />{connectionText(connection, count)}
    </span>
  </nav>;
}

import { scoreRows, visibleScoreRows } from '../worldScores.js';
import './worldScores.css';
export default function WorldScoreboard({ status, roster = [], scores = {}, sessionId }) {
  const rows = visibleScoreRows(scoreRows(roster, scores, sessionId));
  return <aside className="world-scoreboard" aria-label="멀티 플레이 점수">
    <header><strong>SESSION SCORE</strong><span>{status === 'connected' ? `${roster.length} PLAYERS` : 'MULTIPLAYER'}</span></header>
    {status !== 'connected' ? <p role="status">{status === 'connecting' ? '연결 중…' : status === 'unavailable' ? '실시간 연결 미설정' : '연결 끊김 · 점수 동기화 대기'}</p> : <>
      <div className="world-score-columns"><span>플레이어</span><span>PLAYER</span><span>AI</span><span>합계</span></div>
      <ol>{rows.map(row => <li key={row.id} data-self={row.self}>
        <span><small>{row.rank}</small> {row.name}{row.self && <em>나</em>}</span><b>{row.players}</b><b>{row.ai}</b><strong>{row.seq}</strong>
      </li>)}</ol>
      <footer>합계 = 플레이어 처치 + AI 파괴</footer>
    </>}
  </aside>;
}

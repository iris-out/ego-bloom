import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Search, X } from 'lucide-react';
import { CREATOR_TIERS } from '../../design/tiers.js';
import './worldMenu.css';

const SOURCES = [
  ['React', 'https://github.com/facebook/react', 'UI · MIT'],
  ['Three.js', 'https://github.com/mrdoob/three.js', '3D 렌더링 · MIT'],
  ['React Three Fiber / Drei', 'https://github.com/pmndrs/react-three-fiber', '장면 구성 · MIT'],
  ['Lucide', 'https://github.com/lucide-icons/lucide', '아이콘 · ISC'],
  ['Supabase', 'https://github.com/supabase/supabase-js', '실시간 멀티플레이 · MIT'],
];

/** The canvas remains mounted behind this modal. Keyboard focus stays in the menu. */
export default function WorldMenu({ session, count, season, settings, sceneState = 'ready', onRetry, onReload, onGallery, onEnter, onResume, onLeave, onHome, discoverResults = [], discoverCount = 0, query = '', onQuery, discoverStatus = 'ready', discoverEnabled = true, onExploreCreator }) {
  const [page, setPage] = useState('main');
  const root = useRef(null);
  const search = useRef(null);
  const pending = sceneState === 'loading' || sceneState === 'preparing';
  const sceneCopy = sceneState === 'scene-error'
    ? ['CITY / RENDERING', '3D 화면을 열지 못했습니다.', '낮은 그래픽 품질로 다시 시도하거나 새로고침해 주세요.']
    : sceneState === 'loading'
    ? ['CITY / CONNECTING', '도시와 제작자를 연결하고 있습니다.', '잠시 후 이곳에서 탐험을 시작할 수 있습니다.']
    : sceneState === 'preparing'
      ? ['CITY / PREPARING', '도시 장면을 준비하고 있습니다.', '건물과 거리를 화면에 배치하는 중입니다.']
      : sceneState === 'error'
        ? ['CITY / CONNECTION', '도시에 연결하지 못했습니다.', '연결 상태를 확인한 뒤 다시 시도해 주세요.']
        : sceneState === 'empty'
          ? ['CITY / WAITING', '첫 번째 제작자를 기다리고 있습니다.', '건물 컬렉션에서 도시의 모습을 먼저 둘러볼 수 있습니다.']
          : null;
  useEffect(() => {
    const previous = document.activeElement;
    root.current?.querySelector('button')?.focus();
    return () => { if (previous?.isConnected) previous.focus?.(); };
  }, []);
  useEffect(() => { if (page === 'discover') requestAnimationFrame(() => search.current?.focus()); }, [page]);
  const trapFocus = event => {
    if (event.key !== 'Tab') return;
    const nodes = [...root.current.querySelectorAll('button,a[href],input,select')].filter(node => !node.disabled);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && (document.activeElement === first || !root.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  return <section ref={root} className="world-menu" data-scene-state={sceneState} role="dialog" aria-modal="true" aria-labelledby="world-menu-title" onKeyDown={trapFocus}>
    <div className="world-menu-brand"><span className="world-menu-kicker">EGO BLOOM / EGO CITY</span><span className="world-menu-build">WORLD · BETA</span></div>
    <div className="world-menu-layout">
      <div className={`world-menu-left${page === 'discover' ? ' is-discovering' : ''}`}>
        {page === 'discover' ? <div className="world-menu-explorer">
          <div className="world-menu-explorer-head">
            <div><span className="world-menu-kicker">DISCOVER / CITY DIRECTORY</span><h2 id="world-menu-title">도시 탐색</h2></div>
            <button className="world-menu-back" onClick={() => setPage('main')}><ArrowLeft size={15}/>메뉴</button>
          </div>
          <label className="world-menu-search"><Search size={17}/><input ref={search} value={query} onChange={event => onQuery?.(event.target.value)} placeholder="닉네임 또는 아이디로 검색" aria-label="닉네임 또는 아이디로 검색"/>
            {query && <button type="button" aria-label="검색어 지우기" onClick={() => onQuery?.('')}><X size={15}/></button>}
          </label>
          <div className="world-menu-result-heading"><span>{query ? '검색 결과' : '도시의 제작자'}</span><span>{discoverCount.toLocaleString('ko-KR')}명</span></div>
          <div className="world-menu-results" aria-label="제작자 탐색 결과" aria-live="polite">
            {discoverStatus === 'loading' && <p role="status">제작자를 불러오는 중입니다…</p>}
            {discoverStatus === 'error' && <div className="world-menu-results-error" role="alert"><p>제작자 목록을 불러오지 못했습니다.</p><button onClick={onRetry}>다시 시도</button></div>}
            {discoverStatus !== 'loading' && discoverStatus !== 'error' && discoverResults.length === 0 && <p>{query ? '일치하는 닉네임이 없습니다.' : '아직 등록된 제작자가 없습니다.'}</p>}
            {discoverStatus !== 'loading' && discoverResults.slice(0, 8).map(building => {
              const tier = CREATOR_TIERS.find(item => item.key === String(building.tier_name || '').toLowerCase()) || CREATOR_TIERS[0];
              return <button className="world-menu-result" key={building.id} onClick={() => onExploreCreator?.(building)}>
                <span className="world-menu-result-rank">{String(building.rank || '—').padStart(2, '0')}</span>
                <span className="world-menu-result-tier" style={{'--menu-tier':`var(${tier.cssVar})`}}>{tier.code}</span>
                <span className="world-menu-result-copy"><strong>{building.nickname || building.handle || '이름 없는 제작자'}</strong><small>{tier.ko} <i/> ELO {new Intl.NumberFormat('ko-KR', {maximumFractionDigits:1}).format((building.elo_score || 0) / 1000)}</small></span>
                <ArrowUpRight size={15}/>
              </button>;
            })}
          </div>
          <p className="world-menu-explorer-hint">제작자를 선택하면 도시에서 건물 위치를 보여줍니다.</p>
        </div> : <>
        {session && <p className="world-menu-kicker">{session === 'single' ? 'SINGLE PLAYER / PAUSED' : 'MULTIPLAYER / LIVE'}</p>}
        <h1 id="world-menu-title">에고 <br/><em>시티</em></h1>
        <nav aria-label={session ? '게임 메뉴' : '월드 시작 메뉴'} className="world-menu-nav">
          {session ? <button className="world-menu-primary" onClick={onResume}><span>계속하기</span><b>↗</b></button> : <>
            <button className="world-menu-primary" onClick={()=>onEnter('multi')}><span>멀티 플레이<small>같은 도시, 함께하는 플레이어</small></span><b>↗</b></button>
            <button onClick={()=>onEnter('single')}><span>싱글 플레이<small>나만의 속도로 도시 탐험</small></span><b>↗</b></button>
          </>}
          {discoverEnabled && <button aria-pressed={page==='discover'} onClick={()=>setPage('discover')}>탐색<span>01</span></button>}
          <button aria-pressed={page==='settings'} onClick={()=>setPage(page==='settings'?'main':'settings')}>설정<span>02</span></button>
          <button aria-pressed={page==='credits'} onClick={()=>setPage(page==='credits'?'main':'credits')}>크레딧<span>03</span></button>
          {session && <>
            <button className="world-menu-leave" onClick={onLeave}>시작 메뉴로 돌아가기</button>
          </>}
        </nav>
        <button className="world-menu-home" onClick={onHome}>← EGO Bloom으로</button>
        </>}
      </div>
      {page==='discover' ? <div className="world-menu-discover-note"><span className="world-menu-coordinate">A CITY MADE BY CREATORS</span><span className="world-menu-rule"/><strong>닉네임을 찾고<br/>도시를 둘러보세요.</strong><p>{discoverCount.toLocaleString('ko-KR')}명의 제작자가 각자의 건물로 도시를 채웁니다. 결과를 누르면 해당 위치로 이동합니다.</p></div>
        : page==='main' ? sceneCopy && <div className="world-menu-scene-note" role={pending ? 'status' : undefined}><span className="world-menu-coordinate">{sceneCopy[0]}</span><span className="world-menu-rule"/><strong>{sceneCopy[1]}</strong><p>{sceneCopy[2]}</p>
        {(sceneState === 'error' || sceneState === 'scene-error') && onRetry && <button className="world-menu-scene-action" onClick={onRetry}>{sceneState === 'scene-error' ? '낮은 품질로 다시 시도' : '다시 시도'}</button>}
        {sceneState === 'scene-error' && onReload && <button className="world-menu-scene-action" onClick={onReload}>새로고침</button>}
        {sceneState === 'empty' && onGallery && <button className="world-menu-scene-action" onClick={onGallery}>건물 컬렉션 둘러보기</button>}
      </div>
        : <div className="world-menu-detail"><div className="world-menu-detail-head"><span>{page==='settings'?'SETTINGS / 나의 플레이':'CREDITS / 함께 만든 도구'}</span><button onClick={()=>setPage('main')} aria-label="메뉴 세부 화면 닫기">×</button></div>
          {page==='settings'?settings:<div className="world-menu-credits"><h2>에고 시티</h2><p>EGO Bloom 프로젝트의 절차적 도시·차량 모델과 WebAudio 합성 음향을 사용합니다. 도시의 제작자 정보는 EGO Bloom 데이터에서 불러옵니다.</p><h3>오픈소스</h3>{SOURCES.map(([name,url,detail])=><a key={name} href={url} target="_blank" rel="noreferrer"><strong>{name}</strong><span>{detail} ↗</span></a>)}<p>각 프로젝트의 라이선스 및 기여자 정보는 원본 저장소에서 확인할 수 있습니다.</p></div>}
        </div>}
    </div>
    <footer className="world-menu-footer"><span><i/>{pending ? '도시 연결 중' : sceneState === 'scene-error' ? '3D 화면을 확인해 주세요' : sceneState === 'error' ? '도시 연결에 문제가 있습니다' : `${count.toLocaleString('ko-KR')}명의 제작자가 만드는 도시`}</span><span>KST {season.dateKey} · {season.label}</span></footer>
  </section>;
}

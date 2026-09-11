import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Search, SlidersHorizontal, Map, LocateFixed, X, Building2, ChevronDown, ChevronUp, Plane, RotateCcw } from 'lucide-react';
import { CREATOR_TIERS } from '../design/tiers';
import { fetchWorld, filterBuildings } from '../world/data';
import WorldMap from '../world/Map';
import SceneBoundary from '../world/SceneBoundary';
import TouchControls from '../world/TouchControls';
import '../world/world.css';

const WorldScene=lazy(()=>import('../world/WorldScene'));
const GALLERY=CREATOR_TIERS.map((tier,i)=>({id:`gallery-${tier.key}`,nickname:tier.ko,handle:'모델 컬렉션',tier_name:tier.key,rank:i+1,elo_score:0,height:16+i*7,x:(i-3)*32,z:-32}));
const tierOf=b=>CREATOR_TIERS.find(t=>t.key===(b?.tier_name||'').toLowerCase())||CREATOR_TIERS[0];
const number=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1});

export default function WorldPage() {
  const [data,setData]=useState([]), [status,setStatus]=useState('loading'), [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0), [sceneAttempt,setSceneAttempt]=useState(0), [sceneReady,setSceneReady]=useState(false);
  const [query,setQuery]=useState(''), [tier,setTier]=useState('all'), [limit,setLimit]=useState(40);
  const [selectedId,setSelectedId]=useState(null), [gallery,setGallery]=useState(false);
  const [explorerOpen,setExplorerOpen]=useState(false), [settingsOpen,setSettingsOpen]=useState(false), [mapOpen,setMapOpen]=useState(true);
  const [flightMode,setFlightMode]=useState(false);
  const [flightStatus,setFlightStatus]=useState({speed:0,altitude:0,throttle:0,phase:'runway'});
  const flightControls=useRef({throttle:0,pitch:0,roll:0,yaw:0,resetNonce:0});
  const [throttle,setThrottle]=useState(0);
  const [quality,setQuality]=useState(()=>window.matchMedia('(max-width: 760px)').matches?'low':'medium');
  const [timeOfDay,setTimeOfDay]=useState('day'), [weather,setWeather]=useState('clear');
  const [focusTarget,setFocusTarget]=useState({x:0,z:0,nonce:0});
  const [camera,setCamera]=useState({x:0,z:0});
  const stageRef=useRef(null);
  const values=useRef({move:{x:0,y:0},rotate:{x:0,y:0},vertical:0});
  const [mountScene,setMountScene]=useState(false);

  useEffect(()=>{
    // Let the interactive shell paint before importing and constructing WebGL.
    const timer=setTimeout(()=>setMountScene(true),80);
    return ()=>clearTimeout(timer);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    fetchWorld({signal:controller.signal}).then(rows=>{
      if(!controller.signal.aborted){setData(rows);setStatus(rows.length?'ready':'empty');}
    }).catch(e=>{if(!controller.signal.aborted){setError(e.message||'도시 데이터를 불러오지 못했습니다.');setStatus('error');}});
    return ()=>controller.abort();
  },[attempt]);
  useEffect(()=>{
    const reset=()=>{values.current={move:{x:0,y:0},rotate:{x:0,y:0},vertical:0};};
    window.addEventListener('blur',reset);
    return ()=>window.removeEventListener('blur',reset);
  },[]);

  const buildings=gallery?GALLERY:data;
  const selected=buildings.find(b=>b.id===selectedId)||null;
  const results=useMemo(()=>filterBuildings(buildings,query,tier),[buildings,query,tier]);
  const focus=useCallback(point=>{if(Number.isFinite(point?.x)&&Number.isFinite(point?.z))setFocusTarget(previous=>({...point,nonce:previous.nonce+1}));},[]);
  const select=useCallback(b=>{if(!b || !Number.isFinite(b.x) || !Number.isFinite(b.z))return;setSelectedId(b.id);focus({x:b.x,z:b.z});setExplorerOpen(false);},[focus]);
  const ready=useCallback(()=>{setSceneReady(true);if(stageRef.current)stageRef.current.dataset.readyMs=String(Math.round(performance.now()));},[]);
  const reportPerformance=useCallback(stats=>{if(stageRef.current)Object.assign(stageRef.current.dataset,{fps:String(stats.fps),drawCalls:String(stats.calls),triangles:String(stats.triangles)});},[]);
  const retry=()=>{setStatus('loading');setError('');setAttempt(n=>n+1);};
  const toggleGallery=()=>{setFlightMode(false);setGallery(v=>!v);setSelectedId(null);setQuery('');setTier('all');setSceneReady(false);focus({x:0,z:0});};
  const retryScene=()=>{setSceneReady(false);setSceneAttempt(n=>n+1);};
  const changeSearch=value=>{setQuery(value);setLimit(40);setExplorerOpen(true);};
  const canRender=mountScene && (flightMode || gallery || status==='ready');
  const toggleFlight=()=>{setFlightMode(v=>!v);setGallery(false);setSelectedId(null);setExplorerOpen(false);setSettingsOpen(false);flightControls.current={throttle:0,pitch:0,roll:0,yaw:0,resetNonce:0};setThrottle(0);focus({x:0,z:0});};

  return <main className={`world-page${explorerOpen?' world-explorer-open':''}${flightMode?' world-flight-active':''}`}>
    <header className="world-header">
      <Link to="/" className="eb-btn-icon" aria-label="홈으로 돌아가기"><ArrowLeft size={19}/></Link>
      <div className="world-brand"><span className="world-eyebrow">EGO BLOOM / OPEN WORLD</span><h1>크리에이터 시티<span> BETA</span></h1></div>
      <span className="world-population">{gallery?'7가지 건물 컬렉션':`${number.format(data.length)}명의 제작자`}</span>
      <nav aria-label="월드 도구" className="world-tools">
        <button className="eb-btn-icon" aria-label="도시 중심으로 이동" title="도시 중심" onClick={()=>focus({x:0,z:0})}><LocateFixed size={19}/></button>
        <button className="eb-btn-icon" aria-label="건물 컬렉션" title="건물 컬렉션" aria-pressed={gallery} onClick={toggleGallery}><Building2 size={19}/></button>
        <button className="eb-btn-icon" aria-label="전체 지도 표시" aria-pressed={mapOpen} onClick={()=>setMapOpen(v=>!v)}><Map size={19}/></button>
        <button className="eb-btn-icon world-flight-button" aria-label={flightMode?"비행 종료":"비행기 타기"} title={flightMode?"비행 종료":"비행기 타기"} aria-pressed={flightMode} onClick={toggleFlight}><Plane size={19}/></button>
        <button className="eb-btn-icon" aria-label="월드 설정" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(v=>!v)}><SlidersHorizontal size={19}/></button>
      </nav>
    </header>

    <aside className="world-explorer" aria-label="제작자 탐색">
      <div className="world-explorer-title"><div><span className="world-eyebrow">DISCOVER YOUR NEIGHBORS</span><h2>{gallery?'건물 컬렉션':'도시의 제작자'}</h2></div>
        <button className="eb-btn-icon world-explorer-toggle" aria-label={explorerOpen?'제작자 목록 접기':'제작자 목록 펼치기'} aria-expanded={explorerOpen} onClick={()=>setExplorerOpen(v=>!v)}>{explorerOpen?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</button>
      </div>
      <label className="world-search"><Search size={17}/><input aria-label="제작자 검색" value={query} onChange={e=>changeSearch(e.target.value)} placeholder="이름 또는 @핸들 검색" />{query && <button aria-label="검색어 지우기" onClick={()=>changeSearch('')}><X size={15}/></button>}</label>
      <div className="world-explorer-body">
        <div className="world-filter"><label htmlFor="world-tier">티어</label><select id="world-tier" value={tier} onChange={e=>{setTier(e.target.value);setLimit(40);}}><option value="all">모든 티어</option>{CREATOR_TIERS.map(t=><option value={t.key} key={t.key}>{t.ko}</option>)}</select><span>{results.length}명</span></div>
        <p className="world-list-intro">{gallery?'건물을 선택해 형태와 재질을 살펴보세요.':'제작자를 선택하면 건물로 이동합니다.'}</p>
        <div className="world-results" aria-label="제작자 검색 결과">
          {status==='loading'&&!gallery && <p role="status">제작자를 불러오는 중입니다…</p>}
          {status==='error'&&!gallery && <div role="alert"><p>{error}</p><button className="eb-btn eb-btn-secondary" onClick={retry}>다시 시도</button></div>}
          {status!=='loading' && results.length===0 && status!=='error' && <p>{data.length?'검색 결과가 없습니다. 다른 이름이나 티어를 선택해주세요.':'아직 도시에 등록된 제작자가 없습니다.'}</p>}
          {results.slice(0,limit).map(b=>{const t=tierOf(b);return <button className="world-result" key={b.id} aria-pressed={selectedId===b.id} onClick={()=>select(b)}>
            <span className="world-rank">{String(b.rank).padStart(2,'0')}</span><span className="world-tier-mark" style={{'--tier-color':`var(${t.cssVar})`}}>{t.code}</span>
            <span className="world-result-name"><strong>{b.nickname||b.handle||'이름 없는 제작자'}</strong><small>{gallery?t.ko:`@${(b.handle||'').replace(/^@/,'')}`}</small></span><ArrowUpRight size={15}/>
          </button>;})}
          {results.length>limit && <button className="eb-btn eb-btn-secondary world-more" onClick={()=>setLimit(n=>n+40)}>40명 더 보기</button>}
        </div>
        <div className="world-legend"><span>티어별 건물 색상</span><div>{CREATOR_TIERS.map(t=><button key={t.key} title={t.ko} aria-label={`${t.ko}만 보기`} onClick={()=>{setTier(t.key);setLimit(40);}}><i style={{background:`var(${t.cssVar})`}}/>{t.ko}</button>)}</div></div>
      </div>
    </aside>

    <div ref={stageRef} className="world-stage" aria-label="3D 제작자 도시" data-ready={sceneReady?'true':'false'}>
      {canRender ? <SceneBoundary key={`${sceneAttempt}-${gallery}`} onRetry={retryScene}>
        <Suspense fallback={<div className="world-scene-message" role="status"><h2>도시를 준비하고 있습니다</h2><p>제작자 목록은 먼저 탐색할 수 있습니다.</p></div>}>
          <WorldScene buildings={buildings} selectedId={selectedId} onSelect={select} focusTarget={focusTarget} quality={quality} timeOfDay={timeOfDay} weather={weather} onCameraChange={setCamera} onReady={ready} onPerformance={reportPerformance} joystickValues={values} flightMode={flightMode} flightControls={flightControls} onFlightStatus={setFlightStatus}/>
        </Suspense>
      </SceneBoundary> : <div className="world-scene-message" role="status"><span className="world-eyebrow">A CITY MADE OF CREATORS</span><h2>{status==='error'?'도시에 연결하지 못했습니다':status==='empty'?'첫 번째 제작자를 기다리는 도시':'당신의 이야기가 도시가 되는 곳'}</h2><p>{status==='error'?error:status==='empty'?'건물 컬렉션에서 일곱 가지 모델을 먼저 둘러보세요.':'제작자 데이터를 불러오고 있습니다.'}</p>{status==='error' && <button className="eb-btn eb-btn-primary" onClick={retry}>다시 시도</button>}{(status==='error'||status==='empty') && <button className="eb-btn eb-btn-secondary" onClick={toggleGallery}>건물 컬렉션 둘러보기</button>}</div>}
      {canRender && !sceneReady && <span className="world-render-status" role="status">3D 장면 준비 중…</span>}
    </div>

    {selected && <section className="world-selection" aria-label="선택한 제작자">
      <button className="eb-btn-icon world-selection-close" aria-label="선택 닫기" onClick={()=>setSelectedId(null)}><X size={16}/></button>
      <span className="world-eyebrow">{gallery?'BUILDING COLLECTION':`CITY RESIDENT / #${selected.rank}`}</span>
      <h2>{selected.nickname||selected.handle}</h2><p><span className="world-tier-dot" style={{background:`var(${tierOf(selected).cssVar})`}}/>{tierOf(selected).ko}{!gallery && <> · ELO {number.format(selected.elo_score/1000)}</>}</p>
      <div className="world-selection-actions"><button className="eb-btn eb-btn-secondary" onClick={()=>focus({x:selected.x,z:selected.z})}>건물로 이동</button>{!gallery && <Link className="eb-btn eb-btn-primary" to={`/profile?creator=${encodeURIComponent(selected.id)}`}>프로필 보기 <ArrowUpRight size={15}/></Link>}</div>
    </section>}

    {settingsOpen && <section className="world-settings" aria-label="월드 설정 패널">
      <div className="world-settings-title"><h2>월드 설정</h2><button className="eb-btn-icon" aria-label="설정 닫기" onClick={()=>setSettingsOpen(false)}><X size={16}/></button></div>
      <label>그래픽 품질<select value={quality} onChange={e=>setQuality(e.target.value)}><option value="low">낮음 · 가볍게</option><option value="medium">보통 · 균형 있게</option><option value="high">높음 · 섬세하게</option></select></label>
      <label>시간대<select value={timeOfDay} onChange={e=>setTimeOfDay(e.target.value)}><option value="day">낮</option><option value="dawn">새벽</option><option value="sunset">노을</option><option value="night">밤</option></select></label>
      <label>날씨<select value={weather} onChange={e=>setWeather(e.target.value)}><option value="clear">맑음</option><option value="cloudy">흐림</option><option value="rain">비</option><option value="snow">눈</option></select></label>
      <p>품질에 따라 해상도·그림자·주변 장식의 세밀함이 달라집니다.</p>
    </section>}
    {mapOpen && buildings.length>0 && <WorldMap buildings={buildings} selected={selected} camera={camera} onFocus={focus} onSelect={select}/>}
    {flightMode && <section className="world-flight-panel" aria-label="비행 조종석">
      <div className="world-flight-heading"><div><span className="world-eyebrow">EGO AIR / LIGHT JET</span><h2>{flightStatus.phase==='airborne'?'도시 위를 비행 중':'이륙 준비'}</h2></div><button className="eb-btn-icon" aria-label="활주로로 돌아가기" onClick={()=>{flightControls.current.resetNonce++;flightControls.current.throttle=0;setThrottle(0);}}><RotateCcw size={16}/></button></div>
      <div className="world-flight-instruments"><span><b>{Math.round(flightStatus.speed||0)}</b> 속도</span><span><b>{Math.round(flightStatus.altitude||0)}</b> m 고도</span><span><b>{Math.round((flightStatus.throttle||0)*100)}%</b> 출력</span></div>
      <label>스로틀 <input aria-label="비행기 스로틀" type="range" min="0" max="100" value={throttle} onChange={e=>{const value=Number(e.target.value);setThrottle(value);flightControls.current.throttle=value/100;}}/></label>
      <p>{flightStatus.message || '스로틀을 올려 가속한 뒤 기수를 들어 이륙하세요.'}</p>
      <button className="eb-btn eb-btn-secondary" onClick={toggleFlight}>도시 탐색으로 돌아가기</button>
    </section>}
    <footer className="world-help"><span className="world-desktop-help">{flightMode?'W/S 기수 · A/D 기울기 · Q/E 방향 · +/- 스로틀 · 드래그 조종':'WASD / 방향키 이동 · 드래그 회전 · 휠 확대 · Space / Ctrl 고도'}</span><span className="world-mobile-help">{flightMode?'왼쪽 기수·기울기 · 오른쪽 방향 · 스로틀 가속':'왼쪽 이동 · 오른쪽 회전 · 두 손가락 확대'}</span><span>{flightMode?'스로틀을 올린 뒤 기수를 들어 이륙하세요.':'건물 또는 목록을 눌러 제작자 만나기'}</span></footer>
    {flightMode && <TouchControls onMove={(x,y)=>{flightControls.current.roll=x;flightControls.current.pitch=y;}} onRotate={(x)=>{flightControls.current.yaw=x;}} onVertical={value=>{flightControls.current.pitch=value;}}/>}
    {canRender && !flightMode && <TouchControls onMove={(x,y)=>{values.current.move={x,y};}} onRotate={(x,y)=>{values.current.rotate={x,y:-y};}} onVertical={value=>{values.current.vertical=value;}}/>}
  </main>;
}

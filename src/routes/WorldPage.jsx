import WorldScoreboard from '../world/ui/WorldScoreboard';
import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Search, LocateFixed, X } from 'lucide-react';
import { CREATOR_TIERS } from '../design/tiers';
import { proxyThumbnailUrl } from '../utils/imageUtils';
import { fetchWorld, filterBuildings } from '../world/data';
import WorldMap from '../world/Map';
import SceneBoundary from '../world/SceneBoundary';
import TouchControls from '../world/TouchControls';
import Roster from '../world/Roster';
import WorldTabs from '../world/ui/WorldTabs';
import RideLauncher from '../world/ui/RideLauncher';
import RidePicker from '../world/ui/RidePicker';
import TimeAttackHud from '../world/ui/TimeAttackHud';
import { beginTimeAttack, endTimeAttack } from '../world/timeAttackStore.js';
import Countdown from '../world/ui/Countdown';
import RideHud from '../world/ui/RideHud';
import { acceptsInput, createWorldPhase, worldPhaseReducer, sessionPolicy } from '../world/worldPhase';
import { rideOf } from '../world/rideSpecs';
import { displayName, loadIdentity, saveIdentity } from '../world/identity';
import useWorldMultiplayer from '../world/useWorldMultiplayer';
import TabLimitModal from '../world/ui/TabLimitModal';
import { getSeason, getTimeOfDay } from '../world/season';
import { VARIANT_NAMES } from '../world/modelVariant';
import { variantCountOf } from '../world/models/tierBuildings.js';
import { publishRideStatus, resetRideStatus, useRideStatus } from '../world/rideStatusStore';
import { WEAPON_KEYS } from '../world/walkPhysics.js';
import '../world/world.css';
import WorldMenu from '../world/ui/WorldMenu';
import WorldSettings from '../world/ui/WorldSettings';
import { readHudPreferences, writeHudPreferences } from '../world/ui/hudPreferences.js';
import { releaseWorldControls } from '../world/simulationClock.js';
import { setWorldAudio, closeAudio } from '../world/sound.js';

const WorldScene=lazy(()=>import('../world/WorldScene'));
// 갤러리는 티어당 모델 전부를 보여준다. 티어마다 변형 수가 달라(8개 또는 6개) rank 는
// 자리마다 10칸씩 띄워 어느 티어도 다음 티어 자리와 겹치지 않게 한다.
const GALLERY_ROMAN=['I·II','III','IV'];
const GALLERY=CREATOR_TIERS.flatMap((tier,i)=>Array.from({length:variantCountOf(tier.key)},(_,variant)=>({id:`gallery-${tier.key}-${variant}`,nickname:`${tier.ko} ${GALLERY_ROMAN[variant]||String(variant+1)}`,handle:VARIANT_NAMES[tier.key][variant],tier_name:tier.key,rank:i*10+variant+1,model_variant:variant,elo_score:0,height:(16+i*7)*(tier.key==='champion'?2:tier.key==='grandmaster'?1.85:tier.key==='master'?1.7:1),x:[-128,-96,-64,-32,32,64,96,160][i],z:-32-variant*32})));
const GALLERY_COUNT=GALLERY.length;
const tierOf=b=>CREATOR_TIERS.find(t=>t.key===(b?.tier_name||'').toLowerCase())||CREATOR_TIERS[0];
const number=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1});
/** 입력란에 포커스가 있으면 단축키를 잡지 않는다. 검색창에서 Space 를 못 쓰게 되면 안 된다. */
const typing=target=>['INPUT','TEXTAREA','SELECT'].includes(target?.tagName)||target?.isContentEditable;

export default function WorldPage() {
  const navigate=useNavigate();
  const [data,setData]=useState([]), [status,setStatus]=useState('loading'), [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0), [sceneAttempt,setSceneAttempt]=useState(0), [sceneReady,setSceneReady]=useState(false), [sceneFailed,setSceneFailed]=useState(false);
  const [query,setQuery]=useState(''), [tier,setTier]=useState('all'), [limit,setLimit]=useState(40);
  const [selectedId,setSelectedId]=useState(null), [gallery,setGallery]=useState(false);
  const [tab,setTab]=useState(null);
  const [world,dispatch]=useReducer(worldPhaseReducer,undefined,createWorldPhase);
  const [identity,setIdentity]=useState(loadIdentity);
  const [hudPreferences,setHudPreferences]=useState(readHudPreferences);
  const [volume,setVolume]=useState(()=>{try{const value=Number(localStorage.getItem('world-audio-volume') ?? 0.8);return Number.isFinite(value)?Math.max(0,Math.min(1,value)):0.8;}catch{return 0.8;}});
  const policy=sessionPolicy(world);
  const menuVisible=!world.session||world.menuOpen;
  const changeHudPreference=(key,value)=>setHudPreferences(previous=>writeHudPreferences({...previous,[key]:value}));
  useEffect(()=>{setWorldAudio({volume,paused:policy.paused});try{localStorage.setItem('world-audio-volume',String(volume));}catch{/* Storage may be unavailable. */}},[volume,policy.paused]);
  useEffect(()=>()=>{setWorldAudio();endTimeAttack();resetRideStatus();closeAudio();},[]);
  const [pickerGroup,setPickerGroup]=useState('flight');
  const [pendingRide,setPendingRide]=useState({kind:'flight',key:identity.plane});
  const [autopilot,setAutopilot]=useState(false);
  const ride=world.ride, rideKind=ride?.kind||null, driving=world.phase==='driving'||(world.phase==='selecting'&&world.resumePhase==='driving');
  const flightMode=rideKind==='flight', carMode=rideKind==='car', walkMode=rideKind==='walk';
  // 도보는 전용 모델이 없어 자세를 보내지 않는다. 항공기와 차량은 같은 채널로 실시간 공유한다.
  const riding=driving&&(flightMode||carMode);
  // presence 에는 이름과 기종 선택, 지금 타고 있는 탈것을 함께 올린다. 접속자 목록이 이 값을 읽는다.
  const presence=useMemo(()=>({name:identity.name,plane:identity.plane,kind:rideKind||'flight',ride:driving&&ride?ride.key:null}),[identity.name,identity.plane,rideKind,driving,ride]);
  const multiplayer=useWorldMultiplayer(riding,presence,policy.multiplayer);
  const pilotName=displayName(multiplayer.sessionId,identity.name);
  const [view,setView]=useState('third');
  const carControls=useRef({throttle:0,reverse:0,steer:0,brake:false,fire:false,resetNonce:0});
  const flightControls=useRef({throttle:0,pitch:0,roll:0,yaw:0,resetNonce:0});
  const walkControls=useRef({resetNonce:0,reloadNonce:0,fire:false,aim:false,weapon:null});
  const [quality,setQuality]=useState(()=>window.matchMedia('(max-width: 760px)').matches?'low':'medium');
  const [season,setSeason]=useState(()=>getSeason());
  const [timeOfDay,setTimeOfDay]=useState(()=>getTimeOfDay()), [weather,setWeather]=useState('clear');
  // 제작자 미공개. 건물에 붙는 카드가 닉네임과 사진 대신 티어와 번호만 보인다.
  const [anonymous,setAnonymous]=useState(false);
  // 사용자가 설정에서 시간대를 한 번이라도 고르면 그 뒤로는 자동 갱신을 멈춘다.
  const timeOverridden=useRef(false);
  useEffect(()=>{const timer=setInterval(()=>{
    const next=getSeason();
    setSeason(previous=>previous.dateKey===next.dateKey?previous:next);
    if(!timeOverridden.current)setTimeOfDay(getTimeOfDay());
  },30000);return ()=>clearInterval(timer);},[]);
  const [focusTarget,setFocusTarget]=useState({x:0,z:0,nonce:0});
  // 카메라 위치는 0.15초마다 갱신되므로 state 대신 ref 로 받는다. WorldScene 이 값을 기록하고, WorldMap 이 자체 타이머로 읽는다.
  const cameraRef=useRef({x:0,z:0});
  const emptyPeersRef=useRef([]);
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
    const reset=()=>{values.current={move:{x:0,y:0},rotate:{x:0,y:0},vertical:0};Object.assign(flightControls.current,{pitch:0,roll:0,yaw:0,cameraYaw:0,cameraPitch:0,fireCannon:false,fireMissile:false,fireBomb:false,brake:false});};
    window.addEventListener('blur',reset);
    return ()=>window.removeEventListener('blur',reset);
  },[]);

  const buildings=gallery?GALLERY:data;
  const selected=buildings.find(b=>b.id===selectedId)||null;
  const results=useMemo(()=>filterBuildings(buildings,query,tier),[buildings,query,tier]);
  const ranked=useMemo(()=>[...buildings].sort((a,b)=>(a.rank||9999)-(b.rank||9999)).slice(0,40),[buildings]);
  const directoryResults=useMemo(()=>query?filterBuildings(data,query,'all'):[...data].sort((a,b)=>(a.rank||9999)-(b.rank||9999)).slice(0,40),[data,query]);
  const focus=useCallback(point=>{if(Number.isFinite(point?.x)&&Number.isFinite(point?.z))setFocusTarget(previous=>({...point,nonce:previous.nonce+1}));},[]);
  const select=useCallback(b=>{if(!b || !Number.isFinite(b.x) || !Number.isFinite(b.z))return;setSelectedId(b.id);dispatch({type:'explore'});focus({x:b.x,z:b.z,height:b.height,y:b.height*.35});setTab(null);},[focus]);
  const selectInExplorer=useCallback(b=>{if(!b || !Number.isFinite(b.x) || !Number.isFinite(b.z))return;setSelectedId(b.id);dispatch({type:'explore'});focus({x:b.x,z:b.z,height:b.height,y:b.height*.35});},[focus]);
  const ready=useCallback(()=>{setSceneReady(true);if(stageRef.current)stageRef.current.dataset.readyMs=String(Math.round(performance.now()));},[]);
  const reportPerformance=useCallback(stats=>{if(stageRef.current)Object.assign(stageRef.current.dataset,{fps:String(stats.fps),drawCalls:String(stats.calls),triangles:String(stats.triangles)});},[]);
  const retry=()=>{setStatus('loading');setError('');setAttempt(n=>n+1);};
  const retryScene=(nextQuality)=>{if(['low','medium','high'].includes(nextQuality))setQuality(nextQuality);setSceneFailed(false);setSceneReady(false);setSceneAttempt(n=>n+1);};
  const failScene=useCallback(()=>{setSceneFailed(true);setSceneReady(false);},[]);
  const changeSearch=value=>{setQuery(value);setLimit(40);setTab('discover');};
  const toggleGallery=()=>{setSceneFailed(false);setGallery(v=>!v);setSelectedId(null);setQuery('');setTier('all');setSceneReady(false);setTab('discover');dispatch({type:'exitRide'});focus({x:0,z:0});};
  const canRender=mountScene && (driving || gallery || status==='ready');

  const releaseInput=useCallback(()=>{
    releaseWorldControls(carControls.current);releaseWorldControls(flightControls.current);releaseWorldControls(walkControls.current);
    values.current={move:{x:0,y:0},rotate:{x:0,y:0},vertical:0};
    setAutopilot(false);
    if(document.pointerLockElement)document.exitPointerLock?.();
    window.dispatchEvent(new Event('blur'));
  },[]);
  const openMenu=useCallback(()=>{releaseInput();setTab(null);dispatch({type:'openMenu',now:performance.now()});},[releaseInput]);
  const closeMenu=useCallback(()=>dispatch({type:'closeMenu',now:performance.now()}),[]);
  const enterSession=useCallback(mode=>{releaseInput();setTab(null);dispatch({type:'enterSession',mode});},[releaseInput]);
  const leaveSession=useCallback(()=>{releaseInput();setTab(null);resetRideStatus();endTimeAttack();setView('third');dispatch({type:'leaveSession'});},[releaseInput]);

  const openPicker=useCallback(()=>{setTab(null);setSelectedId(null);dispatch({type:'openPicker'});},[]);
  // WorldScene 에 넘기는 콜백이다. dispatch 는 useReducer 가 늘 같은 참조를 주므로 이 함수도 고정된다.
  const onExplore=useCallback(()=>dispatch({type:'explore'}),[]);
  // 활주로에 세운 비행기만 기종을 바꾼다. 공중에서 바꾸면 타던 기체가 터진다.
  // status 전체가 아니라 이 값 하나만 골라 구독하므로, 판정이 안 바뀌면 WorldPage 는 다시 렌더되지 않는다.
  const canSwapSelector=useCallback(s=>rideKind==='flight'&&s.phase==='runway'&&(Number(s.speed)||0)<=3,[rideKind]);
  const canSwapRide=useRideStatus(canSwapSelector);
  const exitRide=useCallback(()=>{
    dispatch({type:'exitRide'});setAutopilot(false);setView('third');resetRideStatus();endTimeAttack();
    carControls.current={throttle:0,reverse:0,steer:0,brake:false,fire:false,resetNonce:0};
    flightControls.current={throttle:0,pitch:0,roll:0,yaw:0,resetNonce:0};
    focus({x:0,z:0});
  },[focus]);
  const launch=useCallback(chosen=>{
    // 기종 선택은 브라우저에만 남는다. 도보는 저장할 기종이 없다.
    if(chosen.kind==='flight')setIdentity(previous=>saveIdentity({...previous,plane:chosen.key}));
    if(chosen.kind==='car')setIdentity(previous=>saveIdentity({...previous,vehicle:chosen.key}));
    resetRideStatus();
    dispatch({type:'launch',ride:chosen,now:performance.now()});
  },[]);
  const finishCountdown=useCallback(()=>{
    // 타임어택으로 출발했으면 카운트다운이 끝나는 순간 판이 걸린다. 시작 시각은 첫 프레임이 찍는다.
    if(world.ride?.mode==='timeAttack')beginTimeAttack();
    dispatch({type:'countdownDone'});
  },[world.ride]);
  // 출발 지점 복귀. HUD 버튼과 R 단축키가 같은 경로를 쓴다. 스로틀 표시는 다음 상태 보고가 따라온다.
  const resetRide=useCallback(()=>{
    const target=flightMode?flightControls:carMode?carControls:walkControls;
    target.current.resetNonce++;
    if(flightMode)flightControls.current.throttle=0;
  },[flightMode,carMode]);

  useEffect(()=>{
    const onKey=event=>{
      if(event.key==='Escape'){
        if(!world.session)return;
        event.preventDefault();
        if(world.menuOpen)closeMenu();
        else if(world.phase==='selecting')dispatch({type:'closePicker'});
        else if(tab)setTab(null);
        else openMenu();
        return;
      }
      if(typing(event.target)||menuVisible)return;
      if(event.code==='Space'&&(world.phase==='establishing'||world.phase==='exploring')){event.preventDefault();openPicker();return;}
      // 항공기는 V 를 미사일에 쓰므로 시점 전환은 C 다.
      if(event.code==='KeyC'&&driving&&rideKind!=='walk'){setView(v=>v==='first'?'third':'first');return;}
      // 도보는 R 이 재장전이라 리셋을 주지 않는다.
      if(event.code==='KeyR'&&driving&&rideKind!=='walk'){event.preventDefault();resetRide();return;}
      if(event.code==='KeyP'&&driving&&rideKind==='flight'){
        event.preventDefault();
        setAutopilot(active=>{const next=!active;flightControls.current.autopilot=next;return next;});
        return;
      }

    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[world.phase,world.session,world.menuOpen,menuVisible,driving,rideKind,tab,openPicker,openMenu,closeMenu,resetRide]);

  const closeTab=()=>setTab(null);
  const rideMeta=ride?rideOf(ride.kind,ride.key):null;

  // 조작 도움말이다. 주행 중에는 HUD 상단 줄에 끼워 넣는다. 화면 구석에 고정하면
  // 계기나 스로틀 레버와 겹친다.
  const helpTip = <details className="world-help-tooltip"><summary aria-label="조작 도움말">?</summary><div role="note">
    <strong>{flightMode?'비행 조작':carMode?'차량 조작':walkMode?'도보 조작':'도시 조작'}</strong>
    <p className="world-desktop-help">{flightMode?(ride?.key==='airship'?'W/S 상승·하강 · A/D 또는 Q/E 선회 · ↑/↓ 스로틀 · Space 감속 · 손을 놓으면 고도 유지':ride?.key==='helicopter'?'↑/↓ 로터 출력 · W/S 전후 기울기 · A/D 기수 회전 · Q/E 좌우 이동 · Space 쌍열 기관총':ride?.key==='fighter'?'W/S 기수 · A/D 기울기 · Q/E 방향 · +/- 스로틀 · Space 기관총 · V 미사일(적기를 2초 담으면 락온)':ride?.key==='interceptor'?'W/S 기수 · A/D 기울기 · Q/E 방향 · +/- 스로틀 · Shift 부스트 · Space 기관총':'W/S 기수 · A/D 기울기와 지상 조향 · Q/E 방향 · +/- 또는 ↑/↓ 스로틀 · 지상에서 Space 브레이크'):carMode?(ride?.key==='drift'?'W/S 가속·후진 · A/D 조향 · Space 드리프트 · 가속으로 유지, 반대 조향으로 회복 · H 전조등':['tank','howitzer','armored'].includes(ride?.key)?'W/S 이동 · A/D 조향 · 방향키 포탑 조준 · Space 또는 좌클릭 발사 · H 전조등 · 3인칭 드래그 시점, 휠 확대':'W/S 가속·후진 · A/D 조향 · Space 브레이크 · H 전조등 · 3인칭 드래그 시점, 휠 확대'):walkMode?`WASD 이동 · Shift 달리기 · Space 점프 · 좌클릭 사격 · 우클릭 정조준 · Q/C 피킹 · E 손전등 · R 재장전 · 1~${WEAPON_KEYS.length} 무기`:'WASD / 방향키 이동 · 드래그 회전 · 휠 확대 · Space 드라이브 시작'}</p>
    <p className="world-mobile-help">{flightMode?(ride?.key==='airship'?'왼쪽 상승·하강·선회 · 오른쪽 시점 · 세로 스로틀 가속':'왼쪽 기수·기울기 · 오른쪽 시점 · 세로 스로틀 가속'):'왼쪽 이동 · 오른쪽 회전 · 두 손가락 확대'}</p>
    <p>{flightMode?'활주로 착륙 가능 · 충돌 시 3초 후 복귀':driving?'ESC 게임 메뉴 · 계속하기로 복귀':'건물 또는 목록을 눌러 제작자 만나기'}</p>
    {flightMode && ride?.key==='fighter' && <p>Space 기관총 · V 미사일 · 모바일은 무장 버튼</p>}
    {flightMode && ride?.key==='prop' && <p>Space 기관총. 전투기보다 연사가 빠르고 탄속은 느리다</p>}
    {flightMode && ride?.key==='interceptor' && <p>Shift 부스트로 1080km/h 까지 낸다. Q 를 누르면 강화 부스트로 바뀌어 1340km/h 까지 열리고 연료를 2.5배로 먹는다. 착륙하면 급유된다</p>}
    {flightMode && ride?.key==='bomber' && <p>Space 를 누르면 폭탄창이 열리고 폭탄이 떨어진다. 땅의 표식이 탄착점이다</p>}
    {flightMode && (ride?.key==='fighter'||ride?.key==='prop'||ride?.key==='helicopter') && <p>조준선이 기관총 탄착점과 유효 사거리를 가리킨다</p>}
    {carMode && ['tank','howitzer','armored'].includes(ride?.key) && <p>Q/E 고개 돌리기, 우클릭 조준경 배율, 조준선 눈금은 사거리다</p>}
    {flightMode && ride?.key==='helicopter' && <p>↑/↓ 로터 출력 · W/S 전후 기울기 · A/D 기수 회전 · Q/E 좌우 이동 · 비행 중 Space 기관총 2정</p>}
    {walkMode && <p>정조준하면 산포와 반동이 줄고 걸음이 느려진다. 저격총은 조준경이 붙는다</p>}
    {walkMode && <p>차도에 서 있으면 차에 치여 체력이 깎인다. 맞지 않으면 스스로 회복한다</p>}
  </div></details>;

  const settings=<WorldSettings quality={quality} onQuality={setQuality} timeOfDay={timeOfDay}
    onTimeOfDay={value=>{timeOverridden.current=true;setTimeOfDay(value);}} weather={weather} onWeather={setWeather}
    anonymous={anonymous} onAnonymous={setAnonymous} volume={volume} onVolume={setVolume}
    {...hudPreferences} onHudScale={value=>changeHudPreference('hudScale',value)}
    onHighContrast={value=>changeHudPreference('highContrast',value)} onReducedMotion={value=>changeHudPreference('reducedMotion',value)}/>;

  return <main className={`world-page${driving?' world-flight-active':''}`} data-phase={world.phase} data-session={world.session||'menu'} data-menu-open={String(menuVisible)} data-scene-ready={String(canRender && sceneReady)}>
    {multiplayer.crowded && <TabLimitModal />}
    {!driving && !menuVisible && <WorldTabs active={tab} onChange={setTab} onHome={openMenu}
      connection={world.session==='single'?'single':multiplayer.status} count={multiplayer.count}/>}

    {tab==='discover' && <aside className="wui-panel" aria-label="제작자 탐색">
      <div className="world-explorer-title">
        <div><span className="world-eyebrow">DISCOVER YOUR NEIGHBORS</span><h2>{gallery?'건물 컬렉션':'도시의 제작자'}</h2></div>
        <button className="eb-btn-icon" aria-label="탐색 닫기" onClick={closeTab}><X size={16}/></button>
      </div>
      <label className="world-search"><Search size={17}/><input aria-label="제작자 검색" value={query} onChange={e=>changeSearch(e.target.value)} placeholder="이름 또는 @핸들 검색" />{query && <button aria-label="검색어 지우기" onClick={()=>changeSearch('')}><X size={15}/></button>}</label>
      <div className="wui-panel-body">
        <div className="world-filter"><label htmlFor="world-tier">티어</label><select id="world-tier" value={tier} onChange={e=>{setTier(e.target.value);setLimit(40);}}><option value="all">모든 티어</option>{CREATOR_TIERS.map(t=><option value={t.key} key={t.key}>{t.ko}</option>)}</select><span>{results.length}명</span></div>
        <div className="wui-picker-tabs" role="tablist" aria-label="표시할 건물">
          <button className="wui-picker-tab" role="tab" aria-selected={!gallery} onClick={()=>{if(gallery)toggleGallery();}}>도시</button>
          <button className="wui-picker-tab" role="tab" aria-selected={gallery} aria-label="건물 컬렉션" onClick={()=>{if(!gallery)toggleGallery();}}>건물 컬렉션</button>
        </div>
        <button className="eb-btn eb-btn-secondary" aria-label="도시 중심으로 이동" onClick={()=>{dispatch({type:'explore'});focus({x:0,z:0});}}><LocateFixed size={15}/>도시 중심</button>
        <p className="world-list-intro">{gallery?'건물을 선택해 형태와 재질을 살펴보세요.':'제작자를 선택하면 건물로 이동합니다.'}</p>
        <div className="world-results" aria-label="제작자 검색 결과">
          {status==='loading'&&!gallery && <p role="status">제작자를 불러오는 중입니다…</p>}
          {status==='error'&&!gallery && <div role="alert"><p>{error}</p><button className="eb-btn eb-btn-secondary" onClick={retry}>다시 시도</button></div>}
          {status!=='loading' && results.length===0 && status!=='error' && <p>{data.length?'검색 결과가 없습니다. 다른 이름이나 티어를 선택해주세요.':'아직 도시에 등록된 제작자가 없습니다.'}</p>}
          {results.slice(0,limit).map(b=>{const t=tierOf(b);return <button className="world-result" key={b.id} aria-pressed={selectedId===b.id} onClick={()=>selectInExplorer(b)}>
            <span className="world-rank">{String(b.rank).padStart(2,'0')}</span><span className="world-tier-mark" style={{'--tier-color':`var(${t.cssVar})`}}>{t.code}</span>
            <span className="world-result-name"><strong>{b.nickname||b.handle||'이름 없는 제작자'}</strong><small>{gallery?b.handle:`@${(b.handle||'').replace(/^@/,'')}`}</small></span><ArrowUpRight size={15}/>
          </button>;})}
          {results.length>limit && <button className="eb-btn eb-btn-secondary world-more" onClick={()=>setLimit(n=>n+40)}>40명 더 보기</button>}
        </div>
        {tab==='discover' && selected && !gallery && <section className="world-panel-selection" aria-label="선택한 제작자">
          <div><span className="world-eyebrow">CITY RESIDENT / #{selected.rank}</span><strong>{selected.nickname||selected.handle}</strong><small>{tierOf(selected).ko} · ELO {number.format(selected.elo_score/1000)}</small></div>
          <div className="world-panel-selection-actions"><button className="eb-btn eb-btn-secondary" onClick={()=>focus({x:selected.x,z:selected.z,height:selected.height,y:selected.height*.35})}>건물로 이동</button><Link className="eb-btn eb-btn-primary" to={`/profile?creator=${encodeURIComponent(selected.id)}`}>프로필 보기 <ArrowUpRight size={15}/></Link></div>
        </section>}
        <div className="world-legend"><span>티어별 건물 색상</span><div>{CREATOR_TIERS.map(t=><button key={t.key} title={t.ko} aria-label={`${t.ko}만 보기`} onClick={()=>{setTier(t.key);setLimit(40);}}><i style={{background:`var(${t.cssVar})`}}/>{t.ko}</button>)}</div></div>
      </div>
    </aside>}

    {tab==='ranking' && <aside className="wui-panel" aria-label="제작자 랭킹">
      <div className="world-explorer-title"><div><span className="world-eyebrow">ELO RANKING</span><h2>상위 제작자</h2></div>
        <button className="eb-btn-icon" aria-label="랭킹 닫기" onClick={closeTab}><X size={16}/></button></div>
      <div className="wui-panel-body world-results">
        {ranked.length===0 && <p>아직 순위를 만들 제작자가 없습니다.</p>}
        {ranked.map(b=>{const t=tierOf(b);return <button className="world-result" key={b.id} onClick={()=>select(b)}>
          <span className="world-rank">{String(b.rank).padStart(2,'0')}</span><span className="world-tier-mark" style={{'--tier-color':`var(${t.cssVar})`}}>{t.code}</span>
          <span className="world-result-name"><strong>{b.nickname||b.handle}</strong><small>ELO {number.format((b.elo_score||0)/1000)}</small></span><ArrowUpRight size={15}/>
        </button>;})}
      </div>
    </aside>}

    {tab==='roster' && <aside className="wui-panel" aria-label="접속자">
      <div className="wui-panel-head"><div><span className="world-eyebrow">WHO IS HERE</span><h2>접속 세션</h2></div>
        <button className="eb-btn-icon" aria-label="접속자 닫기" onClick={closeTab}><X size={16}/></button></div>
      <div className="wui-panel-body">
        <p role="status" data-connection={multiplayer.status}>{multiplayer.status==='connected'?`접속 ${multiplayer.count}명`:multiplayer.status==='connecting'?'연결 중…':multiplayer.status==='unavailable'?'실시간 연결 미설정':world.session==='single'?'싱글 플레이 · 로컬 세션':'재연결 중…'}</p>
        <p className="t-small">로그인 계정 수가 아니라 탭별 접속 세션 수다. 여러 탭은 각각 집계된다.</p>
        <Roster roster={multiplayer.roster} selfId={multiplayer.sessionId}/>
      </div>
    </aside>}

    {tab==='settings' && <section className="wui-panel" aria-label="월드 설정 패널">
      <div className="wui-panel-head"><h2>월드 설정</h2><button className="eb-btn-icon" aria-label="설정 닫기" onClick={closeTab}><X size={16}/></button></div>
      <div className="wui-panel-body">{settings}</div>
    </section>}

    <div ref={stageRef} className="world-stage" aria-hidden={menuVisible || undefined} aria-label="3D 제작자 도시" data-ready={sceneReady?'true':'false'}>
      {canRender ? <SceneBoundary key={`${sceneAttempt}-${gallery}`} onRetry={retryScene} onError={failScene}>
        <Suspense fallback={menuVisible ? null : <div className="world-scene-message" role="status"><h2>도시를 준비하고 있습니다</h2><p>제작자 목록은 먼저 탐색할 수 있습니다.</p></div>}>
          <WorldScene buildings={buildings} selectedId={selectedId} onSelect={select} labelsVisible={!menuVisible&&tab!=='discover'} focusTarget={focusTarget} gallery={gallery} season={season} quality={quality} timeOfDay={timeOfDay} weather={weather} anonymous={anonymous} cameraRef={cameraRef} onReady={ready} onPerformance={reportPerformance} joystickValues={values}
            multiplayer={policy.multiplayer} scoreSession={multiplayer.sessionId || world.session} onConfirmAI={multiplayer.confirmAI} onConfirmFatal={multiplayer.confirmFatal} paused={policy.paused} inputBlocked={policy.inputBlocked} reducedMotion={hudPreferences.reducedMotion} cameraLocked={!world.session||world.phase==='establishing'} ridePending={!!ride} onExplore={onExplore}
            flightMode={flightMode&&driving} flightControls={flightControls} onFlightStatus={publishRideStatus} onFlightPose={multiplayer.publish} peersRef={gallery?emptyPeersRef:multiplayer.peersRef} plane={identity.plane} pilotName={pilotName}
            carMode={carMode&&driving} carControls={carControls} onCarStatus={publishRideStatus} vehicle={identity.vehicle} carView={view} rideView={view}
            walkMode={walkMode&&driving} walkControls={walkControls} onWalkStatus={publishRideStatus}/>
        </Suspense>
      </SceneBoundary> : !menuVisible && <div className="world-scene-message" role="status"><span className="world-eyebrow">A CITY MADE OF CREATORS</span><h2>{status==='error'?'도시에 연결하지 못했습니다':status==='empty'?'첫 번째 제작자를 기다리는 도시':'당신의 이야기가 도시가 되는 곳'}</h2><p>{status==='error'?error:status==='empty'?`건물 컬렉션에서 ${GALLERY_COUNT}가지 모델을 먼저 둘러보세요.`:'제작자 데이터를 불러오고 있습니다.'}</p>{status==='error' && <button className="eb-btn eb-btn-primary" onClick={retry}>다시 시도</button>}{(status==='error'||status==='empty') && <button className="eb-btn eb-btn-secondary" onClick={toggleGallery}>건물 컬렉션 둘러보기</button>}</div>}
      {!menuVisible && canRender && !sceneReady && <span className="world-render-status" role="status">3D 장면 준비 중…</span>}
    </div>

    {selected && !driving && tab!=='discover' && <section className="world-selection" aria-label="선택한 제작자">
      <button className="eb-btn-icon world-selection-close" aria-label="선택 닫기" onClick={()=>setSelectedId(null)}><X size={16}/></button>
      <span className="world-eyebrow">{gallery?'BUILDING COLLECTION':`CITY RESIDENT / #${selected.rank}`}</span>
      <div className="world-selection-head">
        {/* 제작자 사진이 없으면 첫 글자를 쓴다. 제타 이미지는 프록시를 거친다. */}
        {selected.profile_image_url
          ? <img className="world-selection-avatar" src={proxyThumbnailUrl(selected.profile_image_url,192)} alt=""
              width="72" height="72" loading="lazy" draggable="false"
              onError={event=>{event.currentTarget.style.visibility='hidden';}}/>
          : <span className="world-selection-avatar" aria-hidden="true">{(selected.nickname||selected.handle||'?').slice(0,1)}</span>}
        <h2>{selected.nickname||selected.handle}</h2>
      </div><p><span className="world-tier-dot" style={{background:`var(${tierOf(selected).cssVar})`}}/>{tierOf(selected).ko}{!gallery && <> · ELO {number.format(selected.elo_score/1000)}</>}</p>
      <div className="world-selection-actions"><button className="eb-btn eb-btn-secondary" onClick={()=>focus({x:selected.x,z:selected.z,height:selected.height,y:selected.height*.35})}>건물로 이동</button>{!gallery && <Link className="eb-btn eb-btn-primary" to={`/profile?creator=${encodeURIComponent(selected.id)}`}>프로필 보기 <ArrowUpRight size={15}/></Link>}</div>
    </section>}

    {!menuVisible && (world.phase==='establishing'||world.phase==='exploring') && <RideLauncher onOpen={openPicker}/>}
    {!menuVisible && world.phase==='selecting' && <RidePicker group={pickerGroup} onGroup={setPickerGroup}
      selected={pendingRide} onSelect={setPendingRide} onLaunch={launch}
      onClose={()=>dispatch({type:'closePicker'})}/>}
    <Countdown phase={policy.paused?'paused':world.phase} startedAt={world.countdownStartedAt} onDone={finishCountdown} label={rideMeta?.ko}/>

    {world.session === 'multi' && !menuVisible && <WorldScoreboard {...multiplayer} />}
    {driving && !menuVisible && <RideHud kind={rideKind} rideKey={ride.key} pilotName={pilotName}
      peers={multiplayer.count} onMenu={openMenu} {...hudPreferences}
      canSwap={canSwapRide} onSwap={openPicker}
      view={view} onView={setView} autopilot={autopilot}
      onAutopilot={active=>{setAutopilot(active);flightControls.current.autopilot=active;}}
      onThrottle={value=>{flightControls.current.throttle=value/100;}}
      onBrake={active=>{if(flightMode)flightControls.current.brake=active;else if(ride?.key==='drift')carControls.current.handbrake=active;else carControls.current.brake=active;}}
      onFire={(a,b)=>{
        if(flightMode){const slot=a==='missile'?'fireMissile':a==='bomb'?'fireBomb':'fireCannon';flightControls.current[slot]=b;}
        else if(walkMode)walkControls.current.fire=a;
        else carControls.current.fire=a;
      }}
      onAim={active=>{walkControls.current.aim=active;}}
      onWeapon={key=>{walkControls.current.weapon=key;}} onReload={()=>{walkControls.current.reloadNonce++;}}
      onReset={resetRide}
      onExit={exitRide}
      help={helpTip}
      minimap={buildings.length>0?<WorldMap buildings={buildings} selected={selected} cameraRef={cameraRef} onFocus={focus} onSelect={select} compact
        mode={rideKind==='car'?'navigation':'overview'}/>:null}/>}

    {!driving && tab==='map' && buildings.length>0 && <WorldMap buildings={buildings} selected={selected} cameraRef={cameraRef} onFocus={focus} onSelect={select} onAirport={openPicker}/>}

    {driving && !menuVisible && <TimeAttackHud onClose={endTimeAttack}/>}

    {!driving && !menuVisible && helpTip}

    {flightMode&&driving&&!policy.inputBlocked && <TouchControls flight airship={ride?.key==='airship'} onMove={(x,y)=>{flightControls.current.roll=x;flightControls.current.pitch=y;}} onRotate={(x,y)=>{flightControls.current.cameraYaw=x;flightControls.current.cameraPitch=y;}} onVertical={value=>{flightControls.current.pitch=value;}}/>}
    {canRender && !driving && !policy.inputBlocked && acceptsInput(world) && <TouchControls onMove={(x,y)=>{values.current.move={x,y};}} onRotate={(x,y)=>{values.current.rotate={x,y:-y};}} onVertical={value=>{values.current.vertical=value;}}/>}
    {world.session && !menuVisible && !driving && <button className="world-session-menu-button" onClick={openMenu}>메뉴 <span>ESC</span></button>}
    {menuVisible && <WorldMenu session={world.session} count={data.length} season={season} settings={settings} query={query} onQuery={setQuery} discoverResults={directoryResults} discoverCount={query?directoryResults.length:data.length} discoverStatus={status} discoverEnabled={!driving}
      sceneState={sceneFailed?'scene-error':canRender&&sceneReady?'ready':gallery?'preparing':status==='error'?'error':status==='empty'?'empty':status==='loading'?'loading':'preparing'} onRetry={sceneFailed?()=>retryScene('low'):retry} onReload={()=>window.location.reload()} onGallery={toggleGallery}
      onEnter={enterSession} onResume={closeMenu} onLeave={leaveSession} onHome={()=>navigate('/')}
      onExploreCreator={building=>{if(world.session)closeMenu();else enterSession('single');setGallery(false);select(building);}}/>}
  </main>;
}

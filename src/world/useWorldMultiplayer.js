import { useCallback, useEffect, useRef, useState } from 'react';
import { createWorldRoom } from './multiplayer';

const IDLE_STATE = { status: 'connecting', count: null, roster: [], crowded: false };

/** 같은 회선에서 몇 번째 탭인지 세려면 서버가 준 출처 키가 필요하다. 실패하거나
 * 서버에 비밀이 없으면 빈 문자열이고, 그때는 탭 제한을 걸지 않는다. */
async function sessionOrigin() {
  try {
    const response = await fetch('/api/session-origin', { cache: 'no-store' });
    if (!response.ok) return '';
    const body = await response.json();
    return typeof body?.origin === 'string' ? body.origin : '';
  } catch { return ''; }
}

export default function useWorldMultiplayer(riding, identity) {
  const room = useRef(null);
  const [state, setState] = useState(IDLE_STATE);
  const [sessionId, setSessionId] = useState(null);
  // peers 는 broadcast 마다 바뀌므로 state 가 아닌 ref 로 들고, RemoteActors 가 useFrame 에서 직접 읽는다.
  const peersRef = useRef([]);
  const initial = useRef(identity);
  const origin = useRef('');
  useEffect(() => {
    let cancelled=false, connection, interval;
    // Keep Supabase out of the initial bundle used by every route.
    Promise.all([import('../utils/supabase'),sessionOrigin()]).then(([{supabase},key])=>{
      if(cancelled)return;
      if(!supabase){setState({...IDLE_STATE,status:'unavailable'});return;}
      origin.current=key;
      const id=crypto.randomUUID();
      connection=createWorldRoom(supabase,{id,onChange:setState,onPeers:peers=>{peersRef.current=peers;},identity:{...initial.current,origin:key}});
      room.current=connection;
      setSessionId(id);
      interval=setInterval(()=>connection.tick(),100);
    }).catch(()=>{if(!cancelled)setState({...IDLE_STATE,status:'offline'});});
    return ()=>{cancelled=true;clearInterval(interval);connection?.close();room.current=null;peersRef.current=[];setSessionId(null);};
  }, []);
  // 탈것에서 내리면 곧바로 빈 pose 를 보낸다. 남의 화면에서 내 기체가 바로 사라진다.
  useEffect(() => { if (!riding) { room.current?.setPose(null); room.current?.tick(); } }, [riding]);
  // setIdentity 는 profile 을 통째로 갈아 끼운다. 출처 키를 매번 다시 실어야 사라지지 않는다.
  useEffect(() => { room.current?.setIdentity({ ...identity, origin: origin.current }); }, [identity]);
  const publish = useCallback(pose => room.current?.setPose(pose), []);
  return { ...state, sessionId, publish, peersRef };
}

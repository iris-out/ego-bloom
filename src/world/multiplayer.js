import { displayName, validPlane, validVehicle } from './identity.js';

export const WORLD_ROOM = 'ego-bloom-world-v1';
const POSE_FIELDS = ['x', 'y', 'z', 'heading', 'pitch', 'roll'];
/** 세 가지 탈것이 각자의 물리에서 쓰는 단계 이름을 모두 받는다.
 * 모르는 단계는 버린다. 남이 보낸 값이라 화면 분기의 입력이 되면 안 된다. */
const PHASES = ['runway', 'airborne', 'crashed', 'drive', 'sinking', 'walk', 'drowned'];
const RIDE_KINDS = ['flight', 'car', 'walk'];

/** 탈것 종류마다 허용하는 키가 다르다. 남이 보낸 키를 그대로 모델 선택에 쓰지 않는다. */
export function validRideKey(kind, value) {
  if (kind === 'car') return validVehicle(value);
  if (kind === 'walk') return 'walk';
  return validPlane(value);
}

const whole = (value) => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const angle = (value) => Number.isFinite(value) ? Math.max(-Math.PI * 2, Math.min(Math.PI * 2, value)) : 0;

/** 좌표, 자세, 단계, 탈것, 체력, 발사 수를 한 덩어리로 검사한다. 한 칸이라도 이상하면 전부 버린다.
 * kind 가 없는 payload 는 차량 이전 버전의 항공기 pose 다. 그대로 받아 준다. */
export function validPose(value) {
  if (!value || !PHASES.includes(value.phase)) return null;
  if (!POSE_FIELDS.every(key => Number.isFinite(value[key]) && Math.abs(value[key]) <= (['x', 'y', 'z'].includes(key) ? 10000 : 100000))) return null;
  const kind = RIDE_KINDS.includes(value.kind) ? value.kind : 'flight';
  return {
    ...Object.fromEntries(POSE_FIELDS.map(key => [key, value[key]])),
    // Flight projectiles inherit the shooter's forward speed. Clamp remote input
    // so malformed telemetry cannot create arbitrarily fast reconstructed shots.
    speed: Number.isFinite(value.speed) ? Math.max(0, Math.min(value.speed, 500)) : 0,
    phase: value.phase, kind, key: validRideKey(kind, value.key),
    // 체력은 0 에서 1 이다. 없으면 멀쩡한 것으로 본다.
    hull: Number.isFinite(value.hull) ? Math.max(0, Math.min(1, value.hull)) : 1,
    shots: whole(value.shots), rockets: whole(value.rockets),
    turret: angle(value.turret), barrel: angle(value.barrel),
  };
}

// 닉네임과 기체는 남이 보낸 값이다. 표시 전에 항상 다시 다듬는다.
export function profileOf(id, meta) {
  const kind = ['flight', 'car', 'walk'].includes(meta?.kind) ? meta.kind : 'flight';
  // ride 는 지금 타고 있는 것이고 plane 은 기종 선택이다. 탐색 중인 세션은 ride 가 null 이다.
  const ride = meta?.ride ? { kind, key: validRideKey(kind, meta.ride) } : null;
  return { id, name: displayName(id, meta?.name), plane: validPlane(meta?.plane), ride };
}

// status/count/roster 스냅샷이 실제로 바뀌었을 때만 true 를 돌려준다.
function snapshotChanged(previous, next) {
  if (!previous) return true;
  if (previous.status !== next.status || previous.count !== next.count) return true;
  if (previous.crowded !== next.crowded) return true;
  if (previous.roster.length !== next.roster.length) return true;
  return previous.roster.some((entry, index) => {
    const other = next.roster[index];
    return entry.id !== other.id || entry.name !== other.name || entry.plane !== other.plane
      || entry.ride?.key !== other.ride?.key || entry.ride?.kind !== other.ride?.kind;
  });
}

/** presence 에 실어 보내는 값이다. 이름과 기종 선택, 지금 타고 있는 탈것,
 * 그리고 같은 회선을 세기 위한 접속 출처 키다. origin 은 서버가 IP 에 HMAC 을 건 값이라
 * 되돌릴 수 없다. 키를 못 받았으면 빈 문자열이고 그때는 제한을 걸지 않는다. */
function identityProfile(identity) {
  const kind = ['flight', 'car', 'walk'].includes(identity?.kind) ? identity.kind : 'flight';
  return { name: identity?.name || '', plane: validPlane(identity?.plane), kind,
    ride: identity?.ride || null, origin: typeof identity?.origin === 'string' ? identity.origin : '' };
}

/** 한 회선에서 열 수 있는 탭 수다. */
export const TABS_PER_ORIGIN = 2;

/** presence 상태에서 내가 같은 출처의 몇 번째 탭인지 보고 제한을 넘었는지 돌려준다.
 * 먼저 들어온 순서(since) 로 줄을 세우고 같으면 세션 id 로 가른다. 모든 탭이 같은 표를
 * 보고 같은 순서를 매기므로 어느 탭이 밀려나는지에 이견이 생기지 않는다.
 * 출처 키가 없으면(서버에 비밀이 없거나 IP 를 못 읽음) 아무도 막지 않는다.
 */
export function overTabLimit(state, id, limit = TABS_PER_ORIGIN) {
  const last = key => { const metas = state?.[key]; return Array.isArray(metas) ? metas[metas.length - 1] : null; };
  const mine = last(id)?.origin;
  if (!mine) return false;
  const queue = Object.keys(state || {})
    .filter(key => last(key)?.origin === mine)
    .sort((a, b) => (last(a)?.since || 0) - (last(b)?.since || 0) || a.localeCompare(b));
  const rank = queue.indexOf(id);
  return rank >= 0 && rank >= limit;
}

// Presence is slow-changing membership; only Broadcast carries flight telemetry.
// status/count/roster 는 onChange(React state) 로, peers 는 onPeers(ref 갱신용) 로 나눠 알린다.
// broadcast 수신은 count/roster 를 바꾸지 않으므로 onPeers 만 부른다.
export function createWorldRoom(client, { id, onChange, onPeers, now = Date.now, topic = WORLD_ROOM, identity }) {
  let connected = false, closed = false, sequence = 0, pose = null, dirty = false;
  let members = new Set(), status = 'connecting', lastSnapshot = null, crowded = false;
  // 같은 출처끼리 줄을 세울 때 쓰는 입장 시각이다. 탭마다 한 번만 정한다.
  const since = now();
  let profile = identityProfile(identity);
  const peers = new Map(), sequences = new Map(), roster = new Map();
  const readProfile = key => roster.get(key) || profileOf(key, null);
  const notify = () => {
    if (closed) return;
    const snapshot = { status, count: connected ? members.size : null, roster: connected ? [...roster.values()] : [], crowded };
    if (snapshotChanged(lastSnapshot, snapshot)) { lastSnapshot = snapshot; onChange(snapshot); }
  };
  const notifyPeers = () => {
    if (closed) return;
    onPeers?.([...peers.values()].map(peer => ({ ...peer, ...readProfile(peer.id) })));
  };
  const channel = client.channel(topic, { config: { presence: { key: id }, broadcast: { self: false } } });
  const syncRoster = () => {
    const state = channel.presenceState();
    members = new Set(Object.keys(state));
    crowded = overTabLimit(state, id);
    roster.clear();
    for (const [key, metas] of Object.entries(state)) roster.set(key, profileOf(key, metas?.[metas.length - 1]));
  };
  channel.on('presence', { event: 'sync' }, () => {
    if (closed || !connected) return;
    syncRoster();
    let peersChanged = false;
    for (const key of sequences.keys()) if (!members.has(key)) { peers.delete(key); sequences.delete(key); peersChanged = true; }
    notify();
    if (peersChanged) notifyPeers();
  }).on('broadcast', { event: 'flight' }, ({ payload }) => {
    if (closed || !connected || !payload || payload.id === id || !members.has(payload.id)) return;
    if (!Number.isSafeInteger(payload.seq) || payload.seq <= (sequences.get(payload.id) ?? -1)) return;
    const remote = validPose(payload.pose);
    if (payload.pose !== null && !remote) return;
    sequences.set(payload.id, payload.seq);
    if (!remote || remote.phase === 'crashed') peers.delete(payload.id);
    else peers.set(payload.id, { id: payload.id, pose: remote, receivedAt: now() });
    notifyPeers();
  }).subscribe(async result => {
    if (closed) return;
    if (result === 'SUBSCRIBED') {
      connected = true; status = 'connecting';
      try {
        const tracked = await channel.track({ session: id, since, ...profile });
        if (closed || !connected) return;
        if (tracked !== 'ok') { connected = false; status = 'offline'; }
        else { status = 'connected'; dirty = true; syncRoster(); }
      } catch { connected = false; status = 'offline'; }
    } else {
      connected = false; status = 'offline'; peers.clear(); members.clear(); sequences.clear(); roster.clear();
      notify(); notifyPeers();
      return;
    }
    notify();
  });
  notify(); notifyPeers();
  return {
    setPose(value) { pose = validPose(value); dirty = true; },
    setIdentity(value) {
      profile = identityProfile(value);
      if (closed || !connected) return;
      void Promise.resolve(channel.track({ session: id, since, ...profile })).catch(() => {});
    },
    tick() {
      if (closed) return;
      let changed = false;
      for (const [key, peer] of peers) if (now() - peer.receivedAt > 5000) { peers.delete(key); changed = true; }
      if (changed) notifyPeers();
      if (!connected || (!pose && !dirty)) return;
      dirty = false;
      // Broadcast only after subscribing: no HTTP fallback while offline.
      void channel.send({ type: 'broadcast', event: 'flight', payload: { id, seq: ++sequence, pose } }).catch(() => {});
    },
    close() { closed = true; connected = false; peers.clear(); roster.clear(); void client.removeChannel(channel).catch(() => {}); },
  };
}

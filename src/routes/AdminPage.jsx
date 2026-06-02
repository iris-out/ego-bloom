import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

const PULSE_STYLE = '@keyframes admin-pulse{0%,100%{opacity:.5}50%{opacity:1}}';
if (typeof document !== 'undefined' && !document.getElementById('admin-pulse-kf')) {
  const s = document.createElement('style');
  s.id = 'admin-pulse-kf';
  s.textContent = PULSE_STYLE;
  document.head.appendChild(s);
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function adminFetch(method, token, body, query = '') {
  const res = await fetch(`/api/admin-block${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function SkeletonList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.05)', animation: 'admin-pulse 1.5s ease-in-out infinite', opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [tab, setTab] = useState('block');
  const [blockTab, setBlockTab] = useState('single');

  // 단일 차단
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  // 다중 차단
  const [bulkQuery, setBulkQuery] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // 차단 목록
  const [blocked, setBlocked] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  // 이력
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const token = session?.access_token;

  const fetchBlocked = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    const data = await adminFetch('GET', token);
    if (data.blocked) setBlocked(data.blocked);
    setListLoading(false);
  }, [token]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    setHistoryLoading(true);
    const data = await adminFetch('GET', token, null, '?type=history');
    if (data.history) setHistory(data.history);
    setHistoryLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) fetchBlocked();
  }, [token, fetchBlocked]);

  useEffect(() => {
    if (token && tab === 'history') fetchHistory();
  }, [token, tab, fetchHistory]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('이메일 또는 비밀번호가 틀렸습니다.');
    setLoginLoading(false);
  };

  const handleBlock = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setMsg(null);
    const isUUID = /^[0-9a-fA-F-]{36}$/.test(query.trim());
    const body = isUUID ? { id: query.trim(), reason } : { handle: query.trim(), reason };
    const data = await adminFetch('POST', token, body);
    if (data.success) {
      setMsg({ type: 'ok', text: `차단 완료: ${data.id}` });
      setQuery('');
      setReason('');
      fetchBlocked();
    } else {
      setMsg({ type: 'error', text: data.error || '차단 실패' });
    }
    setLoading(false);
  };

  const handleBulkBlock = async () => {
    const lines = bulkQuery.split('\n').map(l => l.trim()).filter(Boolean);
    const reasons = bulkReason.split('\n').map(l => l.trim());
    if (!lines.length) return;

    setBulkLoading(true);
    setBulkResults([]);

    for (let i = 0; i < lines.length; i++) {
      const q = lines[i];
      const r = reasons[i] || '';
      const isUUID = /^[0-9a-fA-F-]{36}$/.test(q);
      const body = isUUID ? { id: q, reason: r } : { handle: q, reason: r };
      const data = await adminFetch('POST', token, body);
      setBulkResults(prev => [...prev, { query: q, success: !!data.success, id: data.id, error: data.error }]);
    }

    setBulkLoading(false);
    fetchBlocked();
  };

  const handleUnblock = async (id, nickname) => {
    if (!window.confirm(`"${nickname}" 차단을 해제하시겠습니까?`)) return;
    setMsg(null);
    const data = await adminFetch('DELETE', token, { id });
    if (data.success) {
      setMsg({ type: 'ok', text: `차단 해제: ${nickname}` });
      fetchBlocked();
    } else {
      setMsg({ type: 'error', text: data.error || '해제 실패' });
    }
  };

  const handleLogout = () => supabase.auth.signOut();

  const bulkLines = bulkQuery.split('\n').filter(l => l.trim()).length;
  const bulkDone = bulkResults.length;

  if (!supabase) {
    return (
      <div style={S.center}>
        <p style={{ color: '#f87171' }}>VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={S.center}>
        <div style={S.card}>
          <h1 style={{ ...S.h1, marginBottom: 24 }}>관리자 로그인</h1>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input type="email" placeholder="이메일" value={email} onChange={e => setEmail(e.target.value)} required style={S.input} />
            <input type="password" placeholder="비밀번호" value={password} onChange={e => setPassword(e.target.value)} required style={S.input} />
            {loginError && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{loginError}</p>}
            <button type="submit" disabled={loginLoading} style={S.primaryBtn}>{loginLoading ? '로그인 중…' : '로그인'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <span style={S.h1}>관리자 패널</span>
        <span style={{ color: '#9ca3af', fontSize: 13 }}>{session.user.email}</span>
        <button onClick={handleLogout} style={S.ghostBtn}>로그아웃</button>
      </div>

      {/* 외부 탭 */}
      <div style={S.tabGroup}>
        <button style={tab === 'block' ? S.tabActive : S.tabInactive} onClick={() => setTab('block')}>사용자 차단</button>
        <button style={tab === 'history' ? S.tabActive : S.tabInactive} onClick={() => setTab('history')}>차단 이력</button>
      </div>

      {tab === 'block' && (
        <>
          {/* 내부 탭 */}
          <div style={S.innerTabGroup}>
            <button style={blockTab === 'single' ? S.innerTabActive : S.innerTabInactive} onClick={() => { setBlockTab('single'); setMsg(null); }}>단일 차단</button>
            <button style={blockTab === 'multi' ? S.innerTabActive : S.innerTabInactive} onClick={() => { setBlockTab('multi'); setMsg(null); }}>다중 차단</button>
          </div>

          {/* 단일 차단 */}
          {blockTab === 'single' && (
            <section style={S.section}>
              <form onSubmit={handleBlock} style={S.formRow}>
                <input
                  placeholder="@핸들 또는 UUID"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={{ ...S.input, flex: 2, minWidth: 0 }}
                />
                <input
                  placeholder="차단 사유 (선택)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  style={{ ...S.input, flex: 3, minWidth: 0 }}
                />
                <button type="submit" disabled={loading || !query.trim()} style={S.blockBtn}>차단</button>
              </form>
              {msg && <p style={{ color: msg.type === 'ok' ? '#4ade80' : '#f87171', fontSize: 13, marginTop: 8 }}>{msg.text}</p>}
            </section>
          )}

          {/* 다중 차단 */}
          {blockTab === 'multi' && (
            <section style={S.section}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, width: isMobile ? '100%' : undefined }}>
                  <label style={{ color: '#6b7280', fontSize: 12 }}>핸들 또는 UUID (한 줄에 하나씩)</label>
                  <textarea
                    placeholder={'@handle1\n@handle2\nuuid-...'}
                    value={bulkQuery}
                    onChange={e => setBulkQuery(e.target.value)}
                    rows={8}
                    disabled={bulkLoading}
                    style={{ ...S.input, resize: 'vertical', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7 }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, width: isMobile ? '100%' : undefined }}>
                  <label style={{ color: '#6b7280', fontSize: 12 }}>사유 (선택, 한 줄에 하나씩)</label>
                  <textarea
                    placeholder={'스팸\n욕설\n(빈 줄이면 사유 없음)'}
                    value={bulkReason}
                    onChange={e => setBulkReason(e.target.value)}
                    rows={8}
                    disabled={bulkLoading}
                    style={{ ...S.input, resize: 'vertical', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.7 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <button
                  onClick={handleBulkBlock}
                  disabled={bulkLoading || !bulkQuery.trim()}
                  style={S.blockBtn}
                >
                  {bulkLoading ? `처리 중… (${bulkDone}/${bulkLines})` : `일괄 차단 ${bulkLines > 0 ? `(${bulkLines}명)` : ''}`}
                </button>
                {bulkResults.length > 0 && !bulkLoading && (
                  <button onClick={() => { setBulkResults([]); setBulkQuery(''); setBulkReason(''); }} style={S.ghostBtn}>초기화</button>
                )}
              </div>

              {bulkResults.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 4 }}>
                    성공 {bulkResults.filter(r => r.success).length} / 실패 {bulkResults.filter(r => !r.success).length}
                  </div>
                  {bulkResults.map((r, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                      <span style={{ color: r.success ? '#4ade80' : '#f87171', fontSize: 14, lineHeight: 1 }}>{r.success ? '✓' : '✗'}</span>
                      <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 12 }}>{r.query}</span>
                      {r.success
                        ? <span style={{ color: '#4b5563', fontSize: 11 }}>{r.id}</span>
                        : <span style={{ color: '#f87171', fontSize: 12 }}>{r.error}</span>
                      }
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 차단된 사용자 목록 */}
          <section style={S.section}>
            <h2 style={S.h2}>차단된 사용자 ({listLoading ? '…' : `${blocked.length}명`})</h2>
            {listLoading ? (
              <SkeletonList />
            ) : blocked.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 14 }}>차단된 사용자가 없습니다.</p>
            ) : isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {blocked.map(u => (
                  <div key={u.id} style={S.mobileCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}>{u.nickname || '-'}</span>
                        <span style={{ color: '#6b7280', fontSize: 12, marginLeft: 6 }}>@{u.handle || '-'}</span>
                      </div>
                      <button onClick={() => handleUnblock(u.id, u.nickname)} style={{ ...S.ghostBtn, flexShrink: 0 }}>해제</button>
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>ELO {u.elo_score?.toLocaleString() || '-'}</span>
                      {u.blocked_reason && <span style={{ color: '#9ca3af', fontSize: 12 }}>{u.blocked_reason}</span>}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>{formatDate(u.blocked_at)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>{['닉네임', '핸들', 'ELO', '사유', '차단일', ''].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {blocked.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={S.td}>{u.nickname || '-'}</td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>@{u.handle || '-'}</td>
                        <td style={S.td}>{u.elo_score?.toLocaleString() || '-'}</td>
                        <td style={{ ...S.td, color: '#9ca3af' }}>{u.blocked_reason || '-'}</td>
                        <td style={{ ...S.td, color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatDate(u.blocked_at)}</td>
                        <td style={S.td}>
                          <button onClick={() => handleUnblock(u.id, u.nickname)} style={S.ghostBtn}>해제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'history' && (
        <section style={S.section}>
          <h2 style={S.h2}>차단 이력</h2>
          {historyLoading ? (
            <SkeletonList />
          ) : history.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 14 }}>이력이 없습니다.</p>
          ) : isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(h => (
                <div key={h.id} style={S.mobileCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={h.action === 'block' ? S.badgeBlock : S.badgeUnblock}>
                        {h.action === 'block' ? '차단' : '해제'}
                      </span>
                      <span style={{ color: '#e5e7eb', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.target_nickname || '-'}</span>
                    </div>
                    <span style={{ color: '#6b7280', fontSize: 11, flexShrink: 0 }}>{formatDate(h.created_at)}</span>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>@{h.target_handle || '-'}</div>
                  {h.reason && <div style={{ color: '#9ca3af', fontSize: 12 }}>{h.reason}</div>}
                  <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>{h.admin_email}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>{['액션', '닉네임', '핸들', '사유', '처리자', '일시'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={S.td}>
                        <span style={h.action === 'block' ? S.badgeBlock : S.badgeUnblock}>
                          {h.action === 'block' ? '차단' : '해제'}
                        </span>
                      </td>
                      <td style={S.td}>{h.target_nickname || '-'}</td>
                      <td style={{ ...S.td, color: '#9ca3af' }}>@{h.target_handle || '-'}</td>
                      <td style={{ ...S.td, color: '#9ca3af' }}>{h.reason || '-'}</td>
                      <td style={{ ...S.td, color: '#9ca3af' }}>{h.admin_email}</td>
                      <td style={{ ...S.td, color: '#9ca3af', whiteSpace: 'nowrap' }}>{formatDate(h.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

const S = {
  center: { minHeight: '100dvh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  page: { minHeight: '100dvh', background: '#0a0a0f', color: '#e5e7eb', padding: '32px 24px', maxWidth: 960, margin: '0 auto' },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32, width: 340 },
  topBar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 },
  section: { marginBottom: 40 },
  formRow: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  h1: { fontSize: 20, fontWeight: 700, color: '#fff', flex: 1, margin: 0 },
  h2: { fontSize: 15, fontWeight: 600, color: '#d1d5db', marginBottom: 14, marginTop: 0 },
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, outline: 'none', minWidth: 0 },
  primaryBtn: { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, padding: '10px 0', color: '#c4b5fd', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  blockBtn: { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, padding: '8px 18px', color: '#fca5a5', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  ghostBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 14px', color: '#9ca3af', fontSize: 13, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', color: '#6b7280', fontWeight: 600, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap' },
  td: { padding: '10px 12px', color: '#e5e7eb' },
  // 외부 탭 (pill)
  tabGroup: { display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: 4, width: 'fit-content', marginBottom: 28 },
  tabActive: { background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.45)', borderRadius: 999, padding: '7px 20px', color: '#c4b5fd', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  tabInactive: { background: 'transparent', border: '1px solid transparent', borderRadius: 999, padding: '7px 20px', color: '#6b7280', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  // 내부 탭 (세그먼트, 더 작고 subtle)
  innerTabGroup: { display: 'flex', gap: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 3, width: 'fit-content', marginBottom: 18 },
  innerTabActive: { background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '5px 16px', color: '#e5e7eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  innerTabInactive: { background: 'transparent', border: '1px solid transparent', borderRadius: 6, padding: '5px 16px', color: '#4b5563', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  mobileCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 14px' },
  badgeBlock: { display: 'inline-block', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 999, padding: '2px 10px', color: '#fca5a5', fontSize: 12, fontWeight: 600, flexShrink: 0 },
  badgeUnblock: { display: 'inline-block', background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 999, padding: '2px 10px', color: '#4ade80', fontSize: 12, fontWeight: 600, flexShrink: 0 },
};

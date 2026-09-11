import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useMediaQuery } from '../hooks/useMediaQuery';

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

/** 액션/상태 배지. up=차단 해제(초록), down=차단(빨강) 성격의 pill. */
function StatusBadge({ tone, children }) {
  const colorVar = tone === 'up' ? '--up' : '--down';
  return (
    <span
      className="t-label inline-flex items-center h-5 px-2.5 shrink-0"
      style={{
        borderRadius: 'var(--radius-pill)',
        background: `color-mix(in srgb, var(${colorVar}) 16%, var(--bg))`,
        color: `var(${colorVar})`,
      }}
    >
      {children}
    </span>
  );
}

function SkeletonList() {
  return (
    <div className="eb-skel flex flex-col gap-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="eb-bone h-10" style={{ opacity: 1 - i * 0.15 }} />
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

  const isMobile = useMediaQuery('(max-width: 640px)');

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
      <div className="min-h-[100dvh] flex items-center justify-center px-6">
        <p className="t-body" style={{ color: 'var(--down)' }}>
          VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.
        </p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6">
        <div className="eb-panel p-8 w-full max-w-[340px]">
          <h1 className="t-h1 text-fg mb-6">관리자 로그인</h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="eb-input"
            />
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="eb-input"
            />
            {loginError && <p className="t-small m-0" style={{ color: 'var(--down)' }}>{loginError}</p>}
            <button type="submit" disabled={loginLoading} className="eb-btn eb-btn-primary">
              {loginLoading ? '로그인 중…' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] text-fg px-6 py-8 max-w-[960px] mx-auto">
      <div className="flex items-center gap-4 mb-6 border-b border-line pb-4">
        <span className="t-h1 flex-1">관리자 패널</span>
        <span className="t-small text-fg-2">{session.user.email}</span>
        <button onClick={handleLogout} className="eb-btn eb-btn-secondary">로그아웃</button>
      </div>

      {/* 외부 탭 */}
      <div className="eb-seg mb-7 w-fit" role="tablist">
        <button role="tab" aria-selected={tab === 'block'} onClick={() => setTab('block')}>사용자 차단</button>
        <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>차단 이력</button>
      </div>

      {tab === 'block' && (
        <>
          {/* 내부 탭 */}
          <div className="eb-seg mb-5 w-fit" role="tablist">
            <button
              role="tab"
              aria-selected={blockTab === 'single'}
              onClick={() => { setBlockTab('single'); setMsg(null); }}
            >
              단일 차단
            </button>
            <button
              role="tab"
              aria-selected={blockTab === 'multi'}
              onClick={() => { setBlockTab('multi'); setMsg(null); }}
            >
              다중 차단
            </button>
          </div>

          {/* 단일 차단 */}
          {blockTab === 'single' && (
            <section className="mb-10">
              <form onSubmit={handleBlock} className="flex gap-2.5 items-center flex-wrap">
                <input
                  placeholder="@핸들 또는 UUID"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="eb-input flex-[2] min-w-0"
                />
                <input
                  placeholder="차단 사유 (선택)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="eb-input flex-[3] min-w-0"
                />
                <button type="submit" disabled={loading || !query.trim()} className="eb-btn eb-btn-secondary whitespace-nowrap" style={{ color: 'var(--down)' }}>
                  차단
                </button>
              </form>
              {msg && (
                <p className="t-small mt-2" style={{ color: msg.type === 'ok' ? 'var(--up)' : 'var(--down)' }}>
                  {msg.text}
                </p>
              )}
            </section>
          )}

          {/* 다중 차단 */}
          {blockTab === 'multi' && (
            <section className="mb-10">
              <div className="flex gap-2.5 items-start flex-col sm:flex-row">
                <div className="flex-1 flex flex-col gap-1.5 w-full">
                  <label className="t-small text-fg-3">핸들 또는 UUID (한 줄에 하나씩)</label>
                  <textarea
                    placeholder={'@handle1\n@handle2\nuuid-...'}
                    value={bulkQuery}
                    onChange={e => setBulkQuery(e.target.value)}
                    rows={8}
                    disabled={bulkLoading}
                    className="eb-input font-mono text-[13px] leading-[1.7] resize-y"
                    style={{ borderRadius: 'var(--radius-s)', height: 'auto', padding: '10px 14px' }}
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1.5 w-full">
                  <label className="t-small text-fg-3">사유 (선택, 한 줄에 하나씩)</label>
                  <textarea
                    placeholder={'스팸\n욕설\n(빈 줄이면 사유 없음)'}
                    value={bulkReason}
                    onChange={e => setBulkReason(e.target.value)}
                    rows={8}
                    disabled={bulkLoading}
                    className="eb-input font-mono text-[13px] leading-[1.7] resize-y"
                    style={{ borderRadius: 'var(--radius-s)', height: 'auto', padding: '10px 14px' }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2.5 mt-2.5">
                <button
                  onClick={handleBulkBlock}
                  disabled={bulkLoading || !bulkQuery.trim()}
                  className="eb-btn eb-btn-secondary"
                  style={{ color: 'var(--down)' }}
                >
                  {bulkLoading ? `처리 중… (${bulkDone}/${bulkLines})` : `일괄 차단 ${bulkLines > 0 ? `(${bulkLines}명)` : ''}`}
                </button>
                {bulkResults.length > 0 && !bulkLoading && (
                  <button onClick={() => { setBulkResults([]); setBulkQuery(''); setBulkReason(''); }} className="eb-btn eb-btn-secondary">
                    초기화
                  </button>
                )}
              </div>

              {bulkResults.length > 0 && (
                <div className="mt-3.5 flex flex-col gap-1.5">
                  <div className="t-small text-fg-3 mb-1">
                    성공 {bulkResults.filter(r => r.success).length} / 실패 {bulkResults.filter(r => !r.success).length}
                  </div>
                  {bulkResults.map((r, i) => (
                    <div key={i} className="flex items-baseline gap-2 t-small">
                      <span style={{ color: r.success ? 'var(--up)' : 'var(--down)' }}>{r.success ? '✓' : '✗'}</span>
                      <span className="font-mono text-fg-2">{r.query}</span>
                      {r.success
                        ? <span className="text-fg-3">{r.id}</span>
                        : <span style={{ color: 'var(--down)' }}>{r.error}</span>
                      }
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 차단된 사용자 목록 */}
          <section className="mb-10">
            <h2 className="t-h3 text-fg-2 mb-3.5">차단된 사용자 ({listLoading ? '…' : `${blocked.length}명`})</h2>
            {listLoading ? (
              <SkeletonList />
            ) : blocked.length === 0 ? (
              <p className="t-body text-fg-3">차단된 사용자가 없습니다.</p>
            ) : isMobile ? (
              <div className="flex flex-col gap-2.5">
                {blocked.map(u => (
                  <div key={u.id} className="eb-panel p-3.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <span className="t-ui text-fg">{u.nickname || '-'}</span>
                        <span className="t-small text-fg-3 ml-1.5">@{u.handle || '-'}</span>
                      </div>
                      <button onClick={() => handleUnblock(u.id, u.nickname)} className="eb-btn eb-btn-secondary shrink-0">해제</button>
                    </div>
                    <div className="flex gap-3.5 mt-1.5 flex-wrap">
                      <span className="t-small text-fg-2">ELO {u.elo_score?.toLocaleString() || '-'}</span>
                      {u.blocked_reason && <span className="t-small text-fg-2">{u.blocked_reason}</span>}
                    </div>
                    <div className="t-small text-fg-3 mt-1">{formatDate(u.blocked_at)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr>
                      {['닉네임', '핸들', 'ELO', '사유', '차단일', ''].map(h => (
                        <th key={h} className="t-small text-fg-3 font-semibold py-2 px-3 border-b border-line whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {blocked.map(u => (
                      <tr key={u.id} className="border-b border-line">
                        <td className="py-2.5 px-3 text-fg">{u.nickname || '-'}</td>
                        <td className="py-2.5 px-3 text-fg-2">@{u.handle || '-'}</td>
                        <td className="py-2.5 px-3 text-fg">{u.elo_score?.toLocaleString() || '-'}</td>
                        <td className="py-2.5 px-3 text-fg-2">{u.blocked_reason || '-'}</td>
                        <td className="py-2.5 px-3 text-fg-2 whitespace-nowrap">{formatDate(u.blocked_at)}</td>
                        <td className="py-2.5 px-3">
                          <button onClick={() => handleUnblock(u.id, u.nickname)} className="eb-btn eb-btn-secondary">해제</button>
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
        <section className="mb-10">
          <h2 className="t-h3 text-fg-2 mb-3.5">차단 이력</h2>
          {historyLoading ? (
            <SkeletonList />
          ) : history.length === 0 ? (
            <p className="t-body text-fg-3">이력이 없습니다.</p>
          ) : isMobile ? (
            <div className="flex flex-col gap-2.5">
              {history.map(h => (
                <div key={h.id} className="eb-panel p-3.5">
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusBadge tone={h.action === 'block' ? 'down' : 'up'}>
                        {h.action === 'block' ? '차단' : '해제'}
                      </StatusBadge>
                      <span className="t-ui text-fg overflow-hidden text-ellipsis whitespace-nowrap">{h.target_nickname || '-'}</span>
                    </div>
                    <span className="t-small text-fg-3 shrink-0">{formatDate(h.created_at)}</span>
                  </div>
                  <div className="t-small text-fg-2 mt-1">@{h.target_handle || '-'}</div>
                  {h.reason && <div className="t-small text-fg-2">{h.reason}</div>}
                  <div className="t-small text-fg-3 mt-0.5">{h.admin_email}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr>
                    {['액션', '닉네임', '핸들', '사유', '처리자', '일시'].map(h => (
                      <th key={h} className="t-small text-fg-3 font-semibold py-2 px-3 border-b border-line whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-b border-line">
                      <td className="py-2.5 px-3">
                        <StatusBadge tone={h.action === 'block' ? 'down' : 'up'}>
                          {h.action === 'block' ? '차단' : '해제'}
                        </StatusBadge>
                      </td>
                      <td className="py-2.5 px-3 text-fg">{h.target_nickname || '-'}</td>
                      <td className="py-2.5 px-3 text-fg-2">@{h.target_handle || '-'}</td>
                      <td className="py-2.5 px-3 text-fg-2">{h.reason || '-'}</td>
                      <td className="py-2.5 px-3 text-fg-2">{h.admin_email}</td>
                      <td className="py-2.5 px-3 text-fg-2 whitespace-nowrap">{formatDate(h.created_at)}</td>
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

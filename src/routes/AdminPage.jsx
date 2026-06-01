import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function adminFetch(method, token, body) {
  const res = await fetch('/api/admin-block', {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [blocked, setBlocked] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const token = session?.access_token;

  const fetchBlocked = useCallback(async () => {
    if (!token) return;
    const data = await adminFetch('GET', token);
    if (data.blocked) setBlocked(data.blocked);
    else setMsg({ type: 'error', text: data.error || '목록을 불러올 수 없습니다.' });
  }, [token]);

  useEffect(() => {
    if (token) fetchBlocked();
  }, [token, fetchBlocked]);

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

      <section style={S.section}>
        <h2 style={S.h2}>사용자 차단</h2>
        <form onSubmit={handleBlock} style={S.row}>
          <input
            placeholder="@핸들 또는 UUID"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ ...S.input, flex: 2, minWidth: 160 }}
          />
          <input
            placeholder="차단 사유 (선택)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{ ...S.input, flex: 3, minWidth: 160 }}
          />
          <button type="submit" disabled={loading || !query.trim()} style={S.blockBtn}>차단</button>
        </form>
        {msg && <p style={{ color: msg.type === 'ok' ? '#4ade80' : '#f87171', fontSize: 13, marginTop: 8 }}>{msg.text}</p>}
      </section>

      <section style={S.section}>
        <h2 style={S.h2}>차단된 사용자 ({blocked.length}명)</h2>
        {blocked.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>차단된 사용자가 없습니다.</p>
        ) : (
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
        )}
      </section>
    </div>
  );
}

const S = {
  center: { minHeight: '100dvh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  page: { minHeight: '100dvh', background: '#0a0a0f', color: '#e5e7eb', padding: '32px 24px', maxWidth: 960, margin: '0 auto' },
  card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 32, width: 340 },
  topBar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 },
  section: { marginBottom: 40 },
  row: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  h1: { fontSize: 20, fontWeight: 700, color: '#fff', flex: 1, margin: 0 },
  h2: { fontSize: 15, fontWeight: 600, color: '#d1d5db', marginBottom: 14, marginTop: 0 },
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, outline: 'none', minWidth: 0 },
  primaryBtn: { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, padding: '10px 0', color: '#c4b5fd', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  blockBtn: { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, padding: '8px 18px', color: '#fca5a5', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  ghostBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 14px', color: '#9ca3af', fontSize: 13, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', color: '#6b7280', fontWeight: 600, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  td: { padding: '10px 12px', color: '#e5e7eb' },
};

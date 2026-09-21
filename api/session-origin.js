// 같은 회선에서 열린 탭 수를 세기 위한 접속 출처 키다.
// 원본 IP 는 절대 내보내지 않는다. 서버만 아는 비밀로 HMAC 을 걸어 되돌릴 수 없게 만든다.
// 비밀이 없으면 IPv4 공간이 좁아 해시만으로 원본 IP 를 되찾을 수 있고, 이 값은 공개
// presence 채널에 실려 다른 접속자에게 그대로 보이므로 비밀이 없으면 키를 주지 않는다.
import { createHmac } from 'node:crypto';
import process from 'node:process';

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const secret = process.env.SESSION_ORIGIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const ip = clientIp(req);
  // 캐시하면 다른 사람의 키를 받는다. 프록시와 CDN 모두에게 저장하지 말라고 알린다.
  res.setHeader('Cache-Control', 'no-store');
  if (!secret || !ip) return res.status(200).json({ origin: null });
  const origin = createHmac('sha256', secret).update(ip).digest('base64url').slice(0, 22);
  return res.status(200).json({ origin });
}

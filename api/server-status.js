// Zeta AI 비상 상태 API를 서버사이드에서 프록시 + 엣지 캐싱
// 브라우저가 external API를 직접 호출하는 대신 Vercel CDN이 공유 캐시를 제공
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const [sRes, mRes] = await Promise.all([
      fetch('https://emergency.zeta-ai.io/ko/status'),
      fetch('https://emergency.zeta-ai.io/ko/message'),
    ]);
    const statusText = (await sRes.text()).trim();
    const message = (await mRes.text()).trim();

    let status = 'error';
    if (statusText === 'green') status = 'ok';
    else if (statusText === 'yellow') status = 'warning';

    // Vercel CDN에서 2분 캐싱 — 동시 방문자가 많아도 external API 1회 호출
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({ status, message: status === 'ok' ? null : (message || null) });
  } catch {
    return res.status(200).json({ status: 'error', message: null });
  }
}

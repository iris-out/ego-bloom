export default async function handler(req, res) {
    const { handle } = req.query;

    if (!handle) {
        return res.status(400).json({ error: 'Handle required' });
    }

    const cleanHandle = handle.replace(/^@/, '');

    // 허용 문자: 알파뉴메릭·한글·하이픈·언더스코어·점 (1~50자)
    if (!/^[a-zA-Z0-9\uAC00-\uD7A3._-]{1,50}$/.test(cleanHandle)) {
      return res.status(400).json({ error: 'Invalid handle format' });
    }

    const targetUrl = `https://zeta-ai.io/@${encodeURIComponent(cleanHandle)}`;

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                // Warning: User-Agent spoofing may violate Zeta-AI ToS or cause blocks.
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            }
        });

        // 리다이렉트 최종 호스트가 zeta-ai.io 도메인이어야 함 (SSRF 완화)
        let finalHost = '';
        try { finalHost = new URL(response.url).hostname; } catch { finalHost = ''; }
        if (!finalHost.endsWith('zeta-ai.io')) {
            return res.status(502).json({ error: 'Unexpected redirect target' });
        }

        const finalUrl = response.url;
        let match = finalUrl.match(/creators\/([a-f0-9-]{36})/i);

        if (!match) {
            const html = await response.text();
            match = html.match(/creators\/([a-f0-9-]{36})/i);
        }

        if (match && match[1]) {
            return res.status(200).json({ id: match[1] });
        } else {
            return res.status(404).json({ error: 'User not found' });
        }
    } catch (e) {
        console.error('[resolve-handle] Error:', e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}

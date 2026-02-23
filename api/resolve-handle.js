export default async function handler(req, res) {
    const { handle } = req.query;

    if (!handle) {
        return res.status(400).json({ error: 'Handle required' });
    }

    const cleanHandle = handle.replace(/^@/, '');
    const targetUrl = `https://zeta-ai.io/@${cleanHandle}`;

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
            }
        });

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

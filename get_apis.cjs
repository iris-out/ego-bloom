const https = require('https');

https.get('https://zeta-ai.io/ko', (res) => {
    let data = ''; res.on('data', c => data += c);
    res.on('end', () => {
        const urls = [...data.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
        urls.forEach(url => {
            if (!url.startsWith('https')) return;
            https.get(url, (res2) => {
                let chunk = ''; res2.on('data', c => chunk += c);
                res2.on('end', () => {
                    const matches = chunk.match(/\/api\/v1\/[a-zA-Z0-9/\-_]+/g);
                    if (matches) {
                        const unique = [...new Set(matches)];
                        console.log(`[${url.split('/').pop()}]`, unique.join(', '));
                    }
                });
            });
        });
    });
});

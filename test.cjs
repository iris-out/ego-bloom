const https = require('https');

https.get('https://zeta-ai.io/ko', (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
        const urls = [...data.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]);
        console.log("Found JS URLs:", urls.slice(0, 10));

        // Now let's fetch the first few chunks and look for 'api/v1/' or 'emergency'
        urls.forEach(url => {
            if (!url.startsWith('https')) return;
            https.get(url, (res2) => {
                let chunkData = '';
                res2.on('data', c => chunkData += c);
                res2.on('end', () => {
                    if (chunkData.includes('emergency')) {
                        console.log(`[FOUND emergency] in ${url}`);
                    }
                    if (chunkData.includes('/api/v')) {
                        const matches = chunkData.match(/\/api\/v[a-zA-Z0-9/\-_]+/g);
                        if (matches) {
                            const unique = [...new Set(matches)];
                            console.log(`[API Endpoints in ${url}]:`, unique);
                        }
                    }
                });
            });
        });
    });
});

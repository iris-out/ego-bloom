export default async function handler(request, response) {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
        return response.status(400).json({ error: 'Path is required' });
    }

    const targetUrl = `https://api.zeta-ai.io/v1${path}`;

    try {
        const apiRes = await fetch(targetUrl, {
            method: "GET",
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; ZetaCardBot/1.0)",
                // Add any other necessary headers here
            },
        });

        const data = await apiRes.json();
        return response.status(apiRes.status).json(data);
    } catch (error) {
        return response.status(500).json({ error: 'Failed to fetch data' });
    }
}

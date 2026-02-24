fetch('https://api.zeta-ai.io/v1/plots/ranking?type=TRENDING&limit=1&filterType=GENRE&filterValues=all').then(r => r.json()).then(d => {
    console.log(JSON.stringify(d.rankings?.[0] || d.plots?.[0], null, 2));
});

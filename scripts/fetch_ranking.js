import fs from 'fs/promises';
import path from 'path';

const ZETA_API_BASE = 'https://api.zeta-ai.io/v1';
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'data', 'ranking_latest.json');

const MAIN_GENRES = [
    '판타지', '로맨스', '무협', 'SF', '스릴러', '공포', '현대', '게임',
    '스포츠', '일상', '학원', '이세계', '전생', '회귀', '빙의', '시스템',
    '성좌', '대체역사', '밀리터리', '추리', 'BL', 'GL', 'TS', '착각',
    '아포칼립스', '디스토피아', '사이버펑크', '스팀펑크', '로판', '무가',
    '순애', '하렘', '역하렘', '피카레스크', '군상극', '먼치킨', '착각계',
    '전문직', '인방', '재벌', '연예계', '스포츠', '요리', '음악', '미술'
];

const BANNED_TAGS = ['hl', '언리밋'];

async function fetchApi(endpoint) {
    const url = `${ZETA_API_BASE}${endpoint}`;
    console.log(`Fetching ${url}...`);
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'EGO-BLOOM Datalab Crawler/1.0'
        }
    });
    if (!res.ok) throw new Error(`API fetched failed with status: ${res.status}`);
    const data = await res.json();
    return data.rankings || data.plots || [];
}

async function generateRankingData() {
    try {
        const [trending, best, newItems] = await Promise.all([
            fetchApi('/plots/ranking?type=TRENDING&limit=100&filterType=GENRE&filterValues=all'),
            fetchApi('/plots/ranking?type=BEST&limit=100&filterType=GENRE&filterValues=all'),
            fetchApi('/plots/ranking?type=NEW&limit=100&filterType=GENRE&filterValues=all')
        ]);

        const calcTags = (list) => {
            const w = {};
            list.forEach(p => {
                const s = Math.max(1, 101 - p.rank);
                (p.hashtags || []).forEach(t => {
                    const tagLower = t.toLowerCase();
                    if (!BANNED_TAGS.includes(tagLower)) {
                        w[tagLower] = (w[tagLower] || 0) + s;
                    }
                });
            });
            return Object.entries(w).sort(([, a], [, b]) => b - a).slice(0, 30).map(([tag, score]) => ({ tag, score }));
        };

        const combined = {};
        const allPlotsMap = new Map(); // 대화량 계산용 중복 제거 맵

        const processPlotForCombined = (p, weight) => {
            if (!p) return;
            allPlotsMap.set(p.id, p);
            const s = Math.max(1, 101 - p.rank) * weight;
            (p.hashtags || []).forEach(t => {
                const tagLower = t.toLowerCase();
                if (!BANNED_TAGS.includes(tagLower)) combined[tagLower] = (combined[tagLower] || 0) + s;
            });
        };

        trending.forEach(p => processPlotForCombined(p, 3));
        best.forEach(p => processPlotForCombined(p, 2));
        newItems.forEach(p => processPlotForCombined(p, 1));

        const combinedList = Object.entries(combined).sort(([, a], [, b]) => b - a).slice(0, 30).map(([tag, score]) => ({ tag, score }));

        // 대화량(Interaction) 기반 해시태그 누적 합산 로직
        const interactionMap = {};
        allPlotsMap.forEach(p => {
            const interactions = p.interactionCountWithRegen ?? p.interactionCount ?? 0;
            (p.hashtags || []).forEach(t => {
                const tagLower = t.toLowerCase();
                if (!BANNED_TAGS.includes(tagLower)) {
                    interactionMap[tagLower] = (interactionMap[tagLower] || 0) + interactions;
                }
            });
        });
        const interactionList = Object.entries(interactionMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 30)
            .map(([tag, score]) => ({ tag, score }));

        const genreMap = {};
        Object.entries(combined).forEach(([tag, score]) => {
            const upperTag = tag.toUpperCase();
            if (MAIN_GENRES.includes(upperTag) || MAIN_GENRES.includes(tag)) {
                const displayTag = MAIN_GENRES.find(g => g.toUpperCase() === upperTag) || tag;
                genreMap[displayTag] = (genreMap[displayTag] || 0) + score;
            }
        });

        const genreEntries = Object.entries(genreMap).sort(([, a], [, b]) => b - a);

        const mainGenres = genreEntries.slice(0, 5).map(([tag, score]) => ({ tag, score }));
        const etcScore = genreEntries.slice(5).reduce((acc, [, score]) => acc + score, 0);
        if (etcScore > 0) mainGenres.push({ tag: '기타', score: etcScore });

        const genreTotal = mainGenres.reduce((acc, curr) => acc + curr.score, 0);
        const genreDist = mainGenres.map(g => ({ ...g, pct: Math.round((g.score / genreTotal) * 100) }));

        const finalData = {
            updatedAt: new Date().toISOString(),
            combined: combinedList,
            trending: calcTags(trending),
            best: calcTags(best),
            new: calcTags(newItems),
            interaction: interactionList,
            genres: genreDist
        };

        await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalData, null, 2), 'utf-8');

        console.log(`✅ Successfully generated ranking data at ${OUTPUT_FILE}`);
    } catch (error) {
        console.error('❌ Failed to generate ranking data:', error);
        process.exit(1);
    }
}

generateRankingData();

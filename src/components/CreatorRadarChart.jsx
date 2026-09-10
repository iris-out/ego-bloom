import { useMemo } from 'react';
import { toKST } from '../utils/tierCalculator';

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 84;
const GUIDES = [1 / 3, 2 / 3, 1];

/**
 * 크리에이터 스탯 육각(오각) 차트다. recharts 없이 정적 SVG polygon 으로 직접 그린다.
 * 축 개수는 아래 data 계산 결과(현재 5개 지표)를 그대로 따른다.
 */
export default function CreatorRadarChart({ stats, characters }) {
  const data = useMemo(() => {
    if (!stats || !characters) return [];

    const normalize = (value, min, max) => {
      if (value <= min) return 20;
      if (value >= max) return 100;
      return 20 + ((value - min) / (max - min)) * 80;
    };

    const plotCount = stats.plotCount || characters.length || 0;

    // 1. 다작 성실 (Diligence)
    let scoreDiligence = 20;
    let daysPerCharStr = 'N/A';
    if (characters.length > 0) {
      // 가장 이른 생성일 기준으로 "지금까지의" 활동 일수 계산 (ProfileHeader와 동일한 기준)
      const timestamps = characters
        .map(c => c.createdAt || c.createdDate)
        .filter(Boolean)
        .map(d => toKST(d).getTime())
        .filter(t => !isNaN(t));

      if (timestamps.length > 0 && plotCount > 0) {
        const earliest = Math.min(...timestamps);
        const now = toKST().getTime();
        const activityDays = Math.max(1, (now - earliest) / (1000 * 60 * 60 * 24));
        const daysPerChar = activityDays / plotCount;
        daysPerCharStr = `${daysPerChar.toFixed(1)}일`;

        // 14 days = 50 pts, 3 days = 100 pts.
        if (daysPerChar <= 3) scoreDiligence = 100;
        else if (daysPerChar >= 25) scoreDiligence = 20;
        else scoreDiligence = 100 - ((daysPerChar - 3) * 4.545);
      }
    }

    // 2. 유저 몰입 (User Engagement - Regen Ratio)
    let totalOriginal = 0;
    let totalWithRegen = 0;
    characters.forEach(c => {
      if (c.originalInteractionCount > 0) {
        totalOriginal += c.originalInteractionCount;
        totalWithRegen += c.interactionCount;
      }
    });
    const regenRatio = totalOriginal > 0 ? (totalWithRegen / totalOriginal) : 1.0;
    const scoreRegen = normalize(regenRatio, 1.0, 1.30);

    // 3. 캐릭터 평균 대화
    const totalInteractions = stats.plotInteractionCount || 0;
    const avgInteractions = plotCount > 0 ? totalInteractions / plotCount : 0;
    const scoreTraffic = normalize(avgInteractions, 10000, 200000);

    // 4. 오픈소스 (Openness)
    let openCount = 0;
    characters.forEach(c => {
      if (c.isLongDescriptionPublic) openCount++;
    });
    const openRatio = plotCount > 0 ? (openCount / plotCount) : 0;
    const scoreOpenness = normalize(openRatio, 0, 0.75);

    // 5. 다양성 (Genre Diversity)
    const uniqueHashtags = new Set();
    characters.forEach(c => {
      if (c.hashtags) c.hashtags.forEach(tag => uniqueHashtags.add(tag));
      else if (c.tags) c.tags.forEach(tag => uniqueHashtags.add(tag));
    });
    const tagCount = uniqueHashtags.size;
    const scoreDiversity = normalize(tagCount, 1, 15);

    return [
      { subject: '다작 성실', A: Math.round(scoreDiligence), raw: `작품당 ${daysPerCharStr}` },
      { subject: '캐릭터 평균 대화', A: Math.round(scoreTraffic), raw: `${Math.round(avgInteractions).toLocaleString()}회` },
      { subject: '유저 몰입', A: Math.round(scoreRegen), raw: `${((regenRatio - 1) * 100).toFixed(1)}% 리롤` },
      { subject: '오픈소스', A: Math.round(scoreOpenness), raw: `${(openRatio * 100).toFixed(1)}% 공개` },
      { subject: '다양성', A: Math.round(scoreDiversity), raw: `${tagCount}개 장르` },
    ];
  }, [stats, characters]);

  if (data.length === 0) return null;

  const n = data.length;
  const angleSlice = (Math.PI * 2) / n;
  const pointAt = (i, ratio) => {
    const val = ratio * RADIUS;
    const angle = angleSlice * i - Math.PI / 2;
    return { x: CENTER + val * Math.cos(angle), y: CENTER + val * Math.sin(angle) };
  };

  const dataPath = data.map((d, i) => pointAt(i, Math.max(0, Math.min(100, d.A)) / 100)).map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ overflow: 'visible' }} role="img" aria-label="크리에이터 스탯 분석">
      {GUIDES.map(g => {
        const pts = data.map((_, i) => pointAt(i, g)).map(p => `${p.x},${p.y}`).join(' ');
        return <polygon key={g} points={pts} fill="none" stroke="var(--line)" strokeWidth={1} />;
      })}

      {data.map((d, i) => {
        const p = pointAt(i, 1);
        return <line key={d.subject} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="var(--line)" strokeWidth={1} />;
      })}

      <polygon
        points={dataPath}
        fill="var(--accent-ink)"
        fillOpacity={0.22}
        stroke="var(--accent-ink)"
        strokeWidth={2}
      />

      {data.map((d, i) => {
        const p = pointAt(i, 1.24);
        return (
          <text key={d.subject} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="t-small" fill="var(--fg-2)">
            <title>{`${d.subject}: ${d.raw} (${d.A}점)`}</title>
            {d.subject}
          </text>
        );
      })}
    </svg>
  );
}

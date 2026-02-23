// ===== CHARACTER TIER SYSTEM (per-character interaction count) =====
export const CHARACTER_TIERS = [
  { name: 'B', key: 'b', min: 0, color: '#A0AEC0', bg: '#EDF2F7', text: '#4A5568' },
  { name: 'A', key: 'a', min: 1000, color: '#48BB78', bg: '#F0FFF4', text: '#22543D' },
  { name: 'S', key: 's', min: 10000, color: '#4299E1', bg: '#EBF8FF', text: '#2A4365' },
  { name: 'R', key: 'r', min: 100000, color: '#9F7AEA', bg: '#FAF5FF', text: '#44337A' },
  { name: 'SR', key: 'sr', min: 1000000, color: '#ED8936', bg: '#FFFAF0', text: '#7B341E' },
  { name: 'X', key: 'x', min: 10000000, color: '#F56565', bg: '#FFF5F5', text: '#742A2A' },
];

/** Returns tooltip text for tier criteria */
export function getTierTooltip(tierKey) {
  const t = CHARACTER_TIERS.find(x => x.key === tierKey) || CHARACTER_TIERS[0];
  const next = CHARACTER_TIERS[CHARACTER_TIERS.indexOf(t) + 1];
  const range = next
    ? `${t.min.toLocaleString()} ~ ${(next.min - 1).toLocaleString()} 대화`
    : `${t.min.toLocaleString()}+ 대화`;
  return `${t.name}: ${range}`;
}

export function getCharacterTier(interactionCount) {
  let tier = CHARACTER_TIERS[0];
  for (let i = CHARACTER_TIERS.length - 1; i >= 0; i--) {
    if (interactionCount >= CHARACTER_TIERS[i].min) {
      tier = CHARACTER_TIERS[i];
      break;
    }
  }
  const idx = CHARACTER_TIERS.indexOf(tier);
  let nextTier = null;
  let progress = 100;
  if (idx < CHARACTER_TIERS.length - 1) {
    nextTier = CHARACTER_TIERS[idx + 1];
    const range = nextTier.min - tier.min;
    const current = interactionCount - tier.min;
    progress = Math.min(100, Math.max(0, (current / range) * 100));
  }
  return { ...tier, progress, nextTier, index: idx };
}

// ===== 크리에이터 티어 시스템 (ELO 점수 기준) =====
export const CREATOR_TIERS = [
  { key: 'unranked', name: 'Unranked', min: -1, gradient: 'from-gray-700 to-gray-800', color: '#718096' },
  { key: 'bronze', name: 'Bronze', min: 0, gradient: 'from-amber-700 to-amber-900', color: '#B7791F' },
  { key: 'silver', name: 'Silver', min: 50000, gradient: 'from-gray-300 to-gray-500', color: '#A0AEC0' },
  { key: 'gold', name: 'Gold', min: 225000, gradient: 'from-yellow-300 to-yellow-600', color: '#ECC94B' },
  { key: 'platinum', name: 'Platinum', min: 1000000, gradient: 'from-cyan-300 to-cyan-600', color: '#38B2AC' },
  { key: 'diamond', name: 'Diamond', min: 4500000, gradient: 'from-blue-400 to-blue-700', color: '#4299E1' },
  { key: 'master', name: 'Master', min: 20000000, gradient: 'from-purple-400 to-purple-800', color: '#9F7AEA' },
  { key: 'champion', name: 'Champion', min: 90000000, gradient: 'from-red-500 to-red-800', color: '#F56565' },
];

// 새로운 ELO V4.1 점수 산정 방식이다. (팔로워 x300, 음성 x100, 기준 완화)
export function calculateCreatorScore(stats, characters) {
  if (!stats) return 0;

  // 1. 총 대화량 (가중치: 3.0)
  const totalInteractions = stats.plotInteractionCount || 0;

  // 2. 팔로워 수 (가중치: 300.0) - V4.1 상향
  const followers = stats.followerCount || 0;

  // 3. 상위 20개 캐릭터 대화량 (추가 가중치: 0.5)
  let top20Sum = 0;
  if (characters && characters.length > 0) {
    const sorted = [...characters].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
    top20Sum = sorted.slice(0, 20).reduce((acc, c) => acc + (c.interactionCount || 0), 0);
  }

  // 4. 평균 대화량 (가중치: 20.0)
  // 0으로 나누는 것을 방지한다.
  const charCount = characters ? characters.length : (stats.plotCount || 1);
  const avgInteractions = charCount > 0 ? totalInteractions / charCount : 0;

  // 5. 음성 재생 수 (가중치: 100.0) - V4.1 상향
  const voicePlays = stats.voicePlayCount || 0;

  const score = (totalInteractions * 3.0)
    + (followers * 300.0)
    + (top20Sum * 0.5)
    + (avgInteractions * 20.0)
    + (voicePlays * 100.0);

  return Math.floor(score);
}

// 최근 6개월(180일) 기준 점수 산정
export function calculateCreatorScoreRecent(stats, characters) {
  if (!stats) return -1; // Stats missing implies unranked or error

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

  // 최근 6개월 내 생성된 캐릭터 필터링
  const recentChars = (characters || []).filter(c => {
    const date = c.createdAt || c.createdDate;
    if (!date) return false;
    return new Date(date) >= sixMonthsAgo;
  });

  // 캐릭터가 없으면 Unranked (-1)
  if (recentChars.length === 0) return -1;

  // 1. 최근 캐릭터 총 대화량
  const totalInteractions = recentChars.reduce((acc, c) => acc + (c.interactionCount || 0), 0);

  // 2. 팔로워 수 (현재 기준 유지)
  const followers = stats.followerCount || 0;

  // 3. 상위 20개 (최근 캐릭터 중)
  let top20Sum = 0;
  if (recentChars.length > 0) {
    const sorted = [...recentChars].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
    top20Sum = sorted.slice(0, 20).reduce((acc, c) => acc + (c.interactionCount || 0), 0);
  }

  // 4. 평균 대화량 (최근 캐릭터 기준)
  const charCount = recentChars.length || 1;
  const avgInteractions = recentChars.length > 0 ? totalInteractions / charCount : 0;

  // 5. 음성 재생 수 (현재 기준 유지)
  const voicePlays = stats.voicePlayCount || 0;

  const score = (totalInteractions * 3.0)
    + (followers * 300.0)
    + (top20Sum * 0.5)
    + (avgInteractions * 20.0)
    + (voicePlays * 100.0);

  return Math.floor(score);
}

export function getCreatorTier(score) {
  // Unranked 처리
  if (score === -1) {
    const unranked = CREATOR_TIERS.find(t => t.key === 'unranked');
    const bronze = CREATOR_TIERS.find(t => t.key === 'bronze');
    return {
      ...unranked,
      progress: 0,
      nextTier: bronze,
      index: 0,
      subdivision: null,
      nextGoalLabel: 'Bronze',
      nextGoalScore: 0,
      subProgress: 0
    };
  }

  let tier = CREATOR_TIERS[1]; // Start checking from Bronze
  // ... loop logic similar to before but careful with indices ...
  // Actually, let's just stick to the loop but skip Unranked in normal check if score >= 0.
  // Bronze min is 0. Unranked is -1.

  for (let i = CREATOR_TIERS.length - 1; i >= 0; i--) {
    if (score >= CREATOR_TIERS[i].min) {
      tier = CREATOR_TIERS[i];
      break;
    }
  }

  const idx = CREATOR_TIERS.indexOf(tier);
  let nextTier = null;
  let progress = 100;
  let subdivision = 1;

  if (idx < CREATOR_TIERS.length - 1) {
    nextTier = CREATOR_TIERS[idx + 1];
    const range = nextTier.min - tier.min;
    const current = score - tier.min;
    const ratio = Math.min(1, Math.max(0, current / range));
    progress = ratio * 100;

    let nextGoalLabel = nextTier.name;
    let nextGoalScore = nextTier.min;
    let subProgress = 0;

    if (tier.key === 'unranked') {
      // Should not happen here if score >= 0, but safe fallback
      subdivision = null;
    } else if (ratio < 0.25) {
      subdivision = 4;
      nextGoalLabel = `${tier.name} 3`;
      nextGoalScore = Math.floor(tier.min + range * 0.25);
      subProgress = (ratio / 0.25) * 100;
    } else if (ratio < 0.5) {
      subdivision = 3;
      nextGoalLabel = `${tier.name} 2`;
      nextGoalScore = Math.floor(tier.min + range * 0.5);
      subProgress = ((ratio - 0.25) / 0.25) * 100;
    } else if (ratio < 0.75) {
      subdivision = 2;
      nextGoalLabel = `${tier.name} 1`;
      nextGoalScore = Math.floor(tier.min + range * 0.75);
      subProgress = ((ratio - 0.5) / 0.25) * 100;
    } else {
      subdivision = 1;
      nextGoalLabel = nextTier.name;
      nextGoalScore = nextTier.min;
      subProgress = ((ratio - 0.75) / 0.25) * 100;
    }

    return { ...tier, progress, nextTier, index: idx, subdivision, nextGoalLabel, nextGoalScore, subProgress };
  }

  return { ...tier, progress: 100, nextTier: null, index: idx, subdivision: 1, nextGoalLabel: 'Max', nextGoalScore: score, subProgress: 100 };
}

export function calculatePercentile(messageCount) {
  if (messageCount > 1000000) return '상위 0.1%';
  if (messageCount > 500000) return '상위 1%';
  if (messageCount > 100000) return '상위 5%';
  if (messageCount > 50000) return '상위 10%';
  if (messageCount > 10000) return '상위 20%';
  if (messageCount > 1000) return '상위 50%';
  return '상위 99%';
}

export function formatNumber(num) {
  if (num == null) return '0';
  if (num >= 100000000) return (num / 100000000).toFixed(1) + '억';
  if (num >= 10000) return (num / 10000).toFixed(1) + '만';
  return new Intl.NumberFormat('ko-KR').format(num);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

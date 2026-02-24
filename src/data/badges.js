/**
 * 칭호(배지) 단일 소스 — Recap, 프로필 카드, 칭호/랭킹 탭에서 공통 사용
 */
import mediaFranchises from './mediaFranchises.json';

const MEDIA_SET = new Set([
  ...mediaFranchises.mobileGames,
  ...mediaFranchises.anime,
  ...mediaFranchises.movies,
  ...mediaFranchises.roblox,
  ...mediaFranchises.tags,
].map(t => t.toLowerCase()));

/** 칭호 메타: id, emoji, title, description(짧은 설명·모달용), desc(탭용 긴 설명), color(tailwind 색상명 또는 'gradient') */
export const BADGE_DEFINITIONS = [
  { id: 'sunae', emoji: '💕', title: '순애보', description: '순애 태그, NTR 없음', desc: '#순애 태그가 있으며, NTR/NTL 태그 없음', color: 'pink' },
  { id: 'ntr', emoji: '💔', title: '사랑 파괴자', description: 'NTR/NTL 등', desc: '#NTR, #NTL, #뺏기, #빼앗기 태그 보유', color: 'red' },
  { id: '2nd', emoji: '🎨', title: '2차창작', description: '게임·애니·영화 2차창작', desc: '게임, 애니, 영화 등 기존 IP 관련 태그 보유', color: 'blue' },
  { id: 'fantasy', emoji: '🗡️', title: '판타지', description: '판타지·마법·기사 등', desc: '#판타지, #마법, #기사, #마왕 등 태그 보유', color: 'indigo' },
  { id: 'newbie', emoji: '🌱', title: '뉴비', description: '활동 3개월 이하', desc: '활동 기간 3개월 이하', color: 'emerald' },
  { id: 'military', emoji: '🎖️', title: '이병부터 병장까지', description: '활동 1년 6개월 이상', desc: '활동 기간 1년 6개월(548일) 이상', color: 'blue' },
  { id: 'oneyear', emoji: '🎂', title: '벌써 1년', description: '활동 1년 이상', desc: '활동 기간 1년(365일) 이상', color: 'emerald' },
  { id: 'cyber', emoji: '⚡', title: '사펑', description: '사이버펑크', desc: '#사이버펑크 태그 보유', color: 'gradient' },
  { id: 'mesu', emoji: '🩷', title: '허접', description: '메스가키·도발', desc: '#메스가키 또는 #도발 태그 보유', color: 'pink' },
  { id: 'unlimit', emoji: '🔮', title: '언리밋', description: 'Unlimited 설정', desc: 'Unlimited 설정된 캐릭터 보유', color: 'violet' },
  { id: 'furry', emoji: '🐾', title: '털', description: '수인·퍼리', desc: '#수인, #수인형, #퍼리 태그 보유', color: 'amber' },
  { id: 'hattrick', emoji: '🎩', title: '해트트릭', description: '100만 대화 캐릭터 3개+', desc: '100만 이상 대화량 캐릭터 3개 이상 보유', color: 'indigo' },
  { id: 'platinum', emoji: '💿', title: '플래티넘 디스크', description: '100만 대화 캐릭터', desc: '100만 이상 대화량 캐릭터 보유', color: 'slate' },
  { id: 'gold_disc', emoji: '📀', title: '골든 디스크', description: '50만 대화 캐릭터', desc: '50만 이상 대화량 캐릭터 보유', color: 'yellow' },
  { id: '10m', emoji: '🎬', title: '천만관객', description: '총 대화 1천만+', desc: '총 대화수 1,000만 이상', color: 'yellow' },
  { id: '1m', emoji: '💬', title: '밀리언', description: '총 대화 100만+', desc: '총 대화수 100만 이상', color: 'amber' },
  { id: 'superstar', emoji: '🌌', title: '우주대스타', description: '팔로워 1만+', desc: '팔로워 10,000명 이상', color: 'gradient' },
  { id: 'family', emoji: '👨‍👩‍👧‍👦', title: '또 하나의 가족', description: '캐릭터 50명+', desc: '50명 이상의 캐릭터 제작', color: 'rose' },
  { id: 'fertile', emoji: '🌾', title: '다산의 상징', description: '캐릭터 100명+', desc: '100명 이상의 캐릭터 제작', color: 'lime' },
  { id: 'iljin', emoji: '🏀', title: '야 체육 안가고 뭐해', description: '#일진 태그', desc: '캐릭터 중 #일진 태그 보유', color: 'orange' },
  { id: 'jjindda', emoji: '🚶', title: '니 애인 지나간다', description: '#찐따 태그', desc: '캐릭터 중 #찐따 태그 보유', color: 'slate' },
  { id: 'original', emoji: '✨', title: '오리지널', description: '2차창작 태그 없음', desc: '게임/애니/영화 등 2차창작 태그 없이 오리지널만 제작', color: 'sky' },
];

export const BADGE_DESCRIPTIONS = Object.fromEntries(
  BADGE_DEFINITIONS.map(b => [b.id, b.description])
);

/** 표시할 칭호 편집에서 고정(토글 불가)인 칭호 id */
export const FIXED_BADGE_IDS = ['sunae', 'ntr'];

const FANTASY_TAGS = ['판타지', '마법', '기사', '마왕', '용사', '엘프', '드래곤'];

/** Pill 스타일: recap(진하게) / profile(연하게) */
const STYLES = {
  recap: {
    pink: { text: 'text-pink-300', bg: 'bg-pink-500/20', border: 'border-pink-500/50' },
    red: { text: 'text-red-300', bg: 'bg-red-500/20', border: 'border-red-500/50' },
    blue: { text: 'text-blue-300', bg: 'bg-blue-500/20', border: 'border-blue-500/50' },
    indigo: { text: 'text-indigo-300', bg: 'bg-indigo-500/20', border: 'border-indigo-500/50' },
    emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/50' },
    yellow: { text: 'text-yellow-300', bg: 'bg-yellow-500/20', border: 'border-yellow-500/50' },
    amber: { text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/50' },
    violet: { text: 'text-violet-300', bg: 'bg-violet-500/20', border: 'border-violet-500/50' },
    slate: { text: 'text-slate-300', bg: 'bg-slate-500/20', border: 'border-slate-500/50' },
    orange: { text: 'text-orange-300', bg: 'bg-orange-500/20', border: 'border-orange-500/50' },
    sky: { text: 'text-sky-300', bg: 'bg-sky-500/20', border: 'border-sky-500/50' },
    rose: { text: 'text-rose-300', bg: 'bg-rose-500/20', border: 'border-rose-500/50' },
    lime: { text: 'text-lime-300', bg: 'bg-lime-500/20', border: 'border-lime-500/50' },
    pink_dark: { text: 'text-pink-400', bg: 'bg-pink-600/20', border: 'border-pink-600/50' },
  },
  profile: {
    pink: { text: 'text-pink-300', bg: 'bg-pink-500/15', border: 'border-pink-400/30' },
    red: { text: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-400/30' },
    blue: { text: 'text-blue-300', bg: 'bg-blue-500/15', border: 'border-blue-400/30' },
    indigo: { text: 'text-indigo-300', bg: 'bg-indigo-500/15', border: 'border-indigo-400/30' },
    emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-400/30' },
    yellow: { text: 'text-yellow-300', bg: 'bg-yellow-500/15', border: 'border-yellow-400/30' },
    amber: { text: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-400/30' },
    violet: { text: 'text-violet-300', bg: 'bg-violet-500/15', border: 'border-violet-400/30' },
    slate: { text: 'text-slate-300', bg: 'bg-slate-500/15', border: 'border-slate-400/30' },
    orange: { text: 'text-orange-300', bg: 'bg-orange-500/15', border: 'border-orange-400/30' },
    sky: { text: 'text-sky-300', bg: 'bg-sky-500/15', border: 'border-sky-400/30' },
    rose: { text: 'text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-400/30' },
    lime: { text: 'text-lime-300', bg: 'bg-lime-500/15', border: 'border-lime-400/30' },
    pink_dark: { text: 'text-pink-300', bg: 'bg-pink-500/15', border: 'border-pink-400/30' },
  },
};

export function getMediaSet() {
  return MEDIA_SET;
}

/**
 * 획득한 칭호 Pill 목록 계산 (Recap, 프로필 카드용)
 * @param {{ characters: Array, stats?: { followerCount?: number }, activityDays: number }} input
 * @param {'recap'|'profile'} variant
 * @returns {{ id, label, text, bg, border, gradient? }[]}
 */
export function computeEarnedPills(input, variant = 'profile') {
  const { characters, stats = {}, activityDays } = input;
  if (!characters?.length) return [];

  const result = [];
  const styleMap = STYLES[variant] || STYLES.profile;
  const allTags = characters.flatMap(c => (c.hashtags || c.tags || []).map(t => t.toLowerCase()));
  const tagSet = new Set(allTags);
  const hasSunae = tagSet.has('순애');
  const hasNtr = tagSet.has('ntr') || tagSet.has('ntl') || tagSet.has('뺏기') || tagSet.has('빼앗기');
  const unlimitedCount = characters.filter(c => c.unlimitedAllowed).length;

  if (hasSunae && !hasNtr) result.push({ id: 'sunae', label: '💕 순애보', ...styleMap.pink });
  if (hasNtr) result.push({ id: 'ntr', label: '💔 사랑 파괴자', ...styleMap.red });
  if (allTags.some(t => MEDIA_SET.has(t))) result.push({ id: '2nd', label: '🎨 2차창작', ...styleMap.blue });
  if (FANTASY_TAGS.some(t => tagSet.has(t))) result.push({ id: 'fantasy', label: '🗡️ 판타지', ...styleMap.indigo });

  if (activityDays <= 90 && activityDays > 0) result.push({ id: 'newbie', label: '🌱 뉴비', ...styleMap.emerald });
  if (activityDays >= 548) result.push({ id: 'military', label: '🎖️ 이병부터 병장까지', ...styleMap.blue });
  else if (activityDays >= 365) result.push({ id: 'oneyear', label: '🎂 벌써 1년', ...styleMap.emerald });

  if (tagSet.has('사이버펑크') || tagSet.has('cyberpunk')) result.push({ id: 'cyber', label: '⚡ 사펑', gradient: true });
  if (tagSet.has('메스가키') || tagSet.has('도발')) result.push({ id: 'mesu', label: '🩷 허접', ...styleMap.pink_dark });
  if (unlimitedCount > 0) result.push({ id: 'unlimit', label: '🔮 언리밋', ...styleMap.violet });
  if (['수인', '수인형', '퍼리', 'furry'].some(t => tagSet.has(t))) result.push({ id: 'furry', label: '🐾 털', ...styleMap.amber });

  const totalInteractions = characters.reduce((s, c) => s + (c.interactionCount || 0), 0);
  const hasMillionChar = characters.some(c => (c.interactionCount || 0) >= 1000000);
  const hasHalfMillionChar = characters.some(c => (c.interactionCount || 0) >= 500000);
  const hatTrick = characters.filter(c => (c.interactionCount || 0) >= 1000000).length >= 3;

  if (hatTrick) result.push({ id: 'hattrick', label: '🎩 해트트릭', ...styleMap.indigo });
  if (hasMillionChar) result.push({ id: 'platinum', label: '💿 플래티넘 디스크', ...styleMap.slate });
  else if (hasHalfMillionChar) result.push({ id: 'gold_disc', label: '📀 골든 디스크', ...styleMap.yellow });

  if (totalInteractions >= 10000000) result.push({ id: '10m', label: '🎬 천만관객', ...styleMap.yellow });
  else if (totalInteractions >= 1000000) result.push({ id: '1m', label: '💬 밀리언', ...styleMap.amber });

  if ((stats.followerCount || 0) >= 10000) result.push({ id: 'superstar', label: '🌌 우주대스타', gradient: true });

  if (characters.length >= 50) result.push({ id: 'family', label: '👨‍👩‍👧‍👦 또 하나의 가족', ...styleMap.rose });
  if (characters.length >= 100) result.push({ id: 'fertile', label: '🌾 다산의 상징', ...styleMap.lime });
  if (tagSet.has('일진')) result.push({ id: 'iljin', label: '🏀 야 체육 안가고 뭐해', ...styleMap.orange });
  if (tagSet.has('찐따')) result.push({ id: 'jjindda', label: '🚶 니 애인 지나간다', ...styleMap.slate });
  const hasNo2nd = !allTags.some(t => MEDIA_SET.has(t));
  if (hasNo2nd && characters.length > 0) result.push({ id: 'original', label: '✨ 오리지널', ...styleMap.sky });

  return result;
}

/** 캐릭터 중 특정 태그 보유 여부 */
function charsWithTag(characters, tag) {
  return characters.filter(c => (c.hashtags || c.tags || []).some(t => t.toLowerCase() === tag)).map(c => c.name);
}
function charsWithAnyTag(characters, tags) {
  return characters.filter(c => (c.hashtags || c.tags || []).some(t => tags.includes(t.toLowerCase()))).map(c => c.name);
}
function charactersWithInteraction(characters, min) {
  return characters.filter(c => (c.interactionCount || 0) >= min);
}

/**
 * 칭호/랭킹 탭용 전체 칭호 목록 (획득 여부 + 관련 캐릭터명)
 * @param {{ characters: Array, stats?: { plotInteractionCount?: number, followerCount?: number } }} input
 * @returns {{ id, emoji, title, desc, color, earned, chars?: string[] }[]}
 */
export function computeEarnedTitles(input) {
  const { characters = [], stats = {} } = input;
  const totalInteractions = stats.plotInteractionCount || 0;
  const followers = stats.followerCount || 0;
  const dates = characters.map(c => c.createdAt || c.createdDate).filter(Boolean).map(d => new Date(d));
  const earliest = dates.length > 0 ? new Date(Math.min(...dates)) : null;
  const activityDays = earliest ? (Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24) : 0;
  const activityMonths = activityDays / 30;

  const list = [];
  const allTags = characters.flatMap(c => (c.hashtags || c.tags || []).map(t => t.toLowerCase()));
  const tagSet = new Set(allTags);
  const hasSunae = tagSet.has('순애');
  const hasNtr = tagSet.has('ntr') || tagSet.has('ntl') || tagSet.has('뺏기') || tagSet.has('빼앗기');
  const unlimitedChars = characters.filter(c => c.unlimitedAllowed);

  list.push({ id: 'sunae', emoji: '💕', title: '순애보', desc: BADGE_DEFINITIONS.find(b => b.id === 'sunae')?.desc ?? '', color: 'pink', earned: hasSunae && !hasNtr, chars: charsWithTag(characters, '순애') });
  list.push({ id: 'ntr', emoji: '💔', title: '사랑 파괴자', desc: BADGE_DEFINITIONS.find(b => b.id === 'ntr')?.desc ?? '', color: 'red', earned: hasNtr, chars: charsWithAnyTag(characters, ['ntr', 'ntl', '뺏기', '빼앗기', '뺏김', '빼앗김']) });
  const mediaChars = characters.filter(c => (c.hashtags || c.tags || []).some(t => MEDIA_SET.has(t.toLowerCase()))).map(c => c.name);
  list.push({ id: '2nd', emoji: '🎨', title: '2차창작', desc: BADGE_DEFINITIONS.find(b => b.id === '2nd')?.desc ?? '', color: 'blue', earned: mediaChars.length > 0, chars: mediaChars });
  const fantasyChars = charsWithAnyTag(characters, ['판타지', '마법', '기사', '마왕', '용사', '엘프', '드래곤']);
  list.push({ id: 'fantasy', emoji: '🗡️', title: '판타지', desc: BADGE_DEFINITIONS.find(b => b.id === 'fantasy')?.desc ?? '', color: 'indigo', earned: fantasyChars.length > 0, chars: fantasyChars });
  list.push({ id: 'newbie', emoji: '🌱', title: '뉴비', desc: BADGE_DEFINITIONS.find(b => b.id === 'newbie')?.desc ?? '', color: 'emerald', earned: activityMonths <= 3 && activityMonths > 0 });
  const cyberChars = charsWithAnyTag(characters, ['사이버펑크', 'cyberpunk']);
  list.push({ id: 'cyber', emoji: '⚡', title: '사펑', desc: BADGE_DEFINITIONS.find(b => b.id === 'cyber')?.desc ?? '', color: 'gradient', earned: cyberChars.length > 0, chars: cyberChars });
  const mesuChars = charsWithAnyTag(characters, ['메스가키', '도발']);
  list.push({ id: 'mesu', emoji: '🩷', title: '허접', desc: BADGE_DEFINITIONS.find(b => b.id === 'mesu')?.desc ?? '', color: 'pink', earned: mesuChars.length > 0, chars: mesuChars });
  list.push({ id: 'unlimit', emoji: '🔮', title: '언리밋', desc: BADGE_DEFINITIONS.find(b => b.id === 'unlimit')?.desc ?? '', color: 'violet', earned: unlimitedChars.length > 0, chars: unlimitedChars.map(c => c.name) });

  list.push({ id: '1m', emoji: '💬', title: '밀리언', desc: BADGE_DEFINITIONS.find(b => b.id === '1m')?.desc ?? '', color: 'amber', earned: totalInteractions >= 1000000 });
  list.push({ id: '10m', emoji: '🎬', title: '천만관객', desc: BADGE_DEFINITIONS.find(b => b.id === '10m')?.desc ?? '', color: 'yellow', earned: totalInteractions >= 10000000 });
  list.push({ id: 'superstar', emoji: '🌌', title: '우주대스타', desc: BADGE_DEFINITIONS.find(b => b.id === 'superstar')?.desc ?? '', color: 'gradient', earned: followers >= 10000 });
  const hattrickChars = charactersWithInteraction(characters, 1000000);
  list.push({ id: 'hattrick', emoji: '🎩', title: '해트트릭', desc: BADGE_DEFINITIONS.find(b => b.id === 'hattrick')?.desc ?? '', color: 'indigo', earned: hattrickChars.length >= 3, chars: hattrickChars.map(c => c.name) });
  const platinumChars = charactersWithInteraction(characters, 1000000);
  list.push({ id: 'platinum', emoji: '💿', title: '플래티넘 디스크', desc: BADGE_DEFINITIONS.find(b => b.id === 'platinum')?.desc ?? '', color: 'slate', earned: platinumChars.length > 0, chars: platinumChars.map(c => c.name) });
  const goldChars = charactersWithInteraction(characters, 500000);
  list.push({ id: 'gold_disc', emoji: '📀', title: '골든 디스크', desc: BADGE_DEFINITIONS.find(b => b.id === 'gold_disc')?.desc ?? '', color: 'yellow', earned: goldChars.length > 0, chars: goldChars.map(c => c.name) });
  list.push({ id: 'furry', emoji: '🐾', title: '털', desc: BADGE_DEFINITIONS.find(b => b.id === 'furry')?.desc ?? '', color: 'amber', earned: ['수인', '수인형', '퍼리', 'furry'].some(t => tagSet.has(t)), chars: charsWithAnyTag(characters, ['수인', '수인형', '퍼리', 'furry']) });
  list.push({ id: 'oneyear', emoji: '🎂', title: '벌써 1년', desc: BADGE_DEFINITIONS.find(b => b.id === 'oneyear')?.desc ?? '', color: 'emerald', earned: activityDays >= 365 });
  list.push({ id: 'military', emoji: '🎖️', title: '이병부터 병장까지', desc: BADGE_DEFINITIONS.find(b => b.id === 'military')?.desc ?? '', color: 'blue', earned: activityDays >= 548 });

  list.push({ id: 'family', emoji: '👨‍👩‍👧‍👦', title: '또 하나의 가족', desc: BADGE_DEFINITIONS.find(b => b.id === 'family')?.desc ?? '', color: 'rose', earned: characters.length >= 50 });
  list.push({ id: 'fertile', emoji: '🌾', title: '다산의 상징', desc: BADGE_DEFINITIONS.find(b => b.id === 'fertile')?.desc ?? '', color: 'lime', earned: characters.length >= 100 });
  list.push({ id: 'iljin', emoji: '🏀', title: '야 체육 안가고 뭐해', desc: BADGE_DEFINITIONS.find(b => b.id === 'iljin')?.desc ?? '', color: 'orange', earned: tagSet.has('일진'), chars: charsWithTag(characters, '일진') });
  list.push({ id: 'jjindda', emoji: '🚶', title: '니 애인 지나간다', desc: BADGE_DEFINITIONS.find(b => b.id === 'jjindda')?.desc ?? '', color: 'slate', earned: tagSet.has('찐따'), chars: charsWithTag(characters, '찐따') });
  const hasNo2nd = !characters.some(c => (c.hashtags || c.tags || []).some(t => MEDIA_SET.has(t.toLowerCase())));
  list.push({ id: 'original', emoji: '✨', title: '오리지널', desc: BADGE_DEFINITIONS.find(b => b.id === 'original')?.desc ?? '', color: 'sky', earned: hasNo2nd && characters.length > 0 });

  return list;
}

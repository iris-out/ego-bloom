import { toKST } from '../utils/tierCalculator';
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
  { id: 'fantasy', emoji: '🗡️', title: '판타지', description: '판타지·마법·기사 등', desc: '#판타지, #마법, #기사, #마왕 등 태그 보유', color: 'indigo' },
  { id: 'newbie', emoji: '🌱', title: '뉴비', description: '활동 3개월 이하', desc: '활동 기간 3개월 이하', color: 'emerald' },
  { id: 'military', emoji: '🎖️', title: '고인물', description: '활동 1년 6개월 이상', desc: '활동 기간 1년 6개월(548일) 이상', color: 'blue' },
  { id: 'oneyear', emoji: '🎂', title: '벌써 1년', description: '활동 1년 이상', desc: '활동 기간 1년(365일) 이상', color: 'emerald' },
  { id: 'cyber', emoji: '⚡', title: '사펑', description: '사이버펑크', desc: '#사이버펑크 태그 보유', color: 'gradient' },
  { id: 'mesu', emoji: '🩷', title: '허접', description: '메스가키·도발', desc: '#메스가키 또는 #도발 태그 보유', color: 'pink' },
  { id: 'unlimit', emoji: '🔮', title: '언리밋', description: 'Unlimited 설정', desc: 'Unlimited 설정된 캐릭터 보유', color: 'violet' },
  { id: 'furry', emoji: '🐾', title: '털', description: '수인·퍼리', desc: '#수인, #수인형, #퍼리 태그 보유', color: 'amber' },
  { id: 'hattrick', emoji: '🎩', title: '해트트릭', description: '100만 대화 캐릭터 3개+', desc: '100만 이상 대화량 캐릭터 3개 이상 보유', color: 'indigo' },
  { id: 'platinum', emoji: '💿', title: '플래티넘 디스크', description: '100만 대화 캐릭터', desc: '100만 이상 대화량 캐릭터 보유', color: 'slate' },
  { id: '10m', emoji: '🎬', title: '천만관객', description: '총 대화 1천만+', desc: '총 대화수 1,000만 이상', color: 'yellow' },
  { id: '1m', emoji: '💬', title: '밀리언', description: '총 대화 100만+', desc: '총 대화수 100만 이상', color: 'amber' },
  { id: 'superstar', emoji: '🌌', title: '우주대스타', description: '팔로워 1만+', desc: '팔로워 10,000명 이상', color: 'gradient' },
  { id: 'fertile', emoji: '🌾', title: '다산의 상징', description: '캐릭터 100명+', desc: '100명 이상의 캐릭터 제작', color: 'lime' },
  { id: 'iljin', emoji: '🏀', title: '일진', description: '#일진 태그', desc: '캐릭터 중 #일진 태그 보유', color: 'orange' },
  { id: 'jjindda', emoji: '🚶', title: '찐따', description: '#찐따 태그', desc: '캐릭터 중 #찐따 태그 보유', color: 'slate' },
  { id: 'hero', emoji: '🦸', title: '취미일 뿐', description: '#히어로 태그', desc: '캐릭터 중 #히어로 태그 보유', color: 'amber' },
  { id: 'academy', emoji: '🎓', title: '아카데미', description: '#아카데미 태그', desc: '캐릭터 중 #아카데미 태그 보유', color: 'indigo' },
  { id: 'hyeongwan', emoji: '🖤', title: '혐관', description: '#혐관 태그', desc: '캐릭터 중 #혐관 태그 보유', color: 'slate' },
  { id: 'pipye', emoji: '😵', title: '피폐', description: '#피폐 태그', desc: '캐릭터 중 #피폐 태그 보유', color: 'violet' },
  { id: 'sihanbu', emoji: '💧', title: '시한부', description: '#시한부 태그', desc: '캐릭터 중 #시한부 태그 보유', color: 'red' },
  { id: 'guwon', emoji: '🩹', title: '구원', description: '#구원 태그', desc: '캐릭터 중 #구원 태그 보유', color: 'emerald' },
  { id: 'original', emoji: '✨', title: '오리지널', description: '2차창작 태그 없음', desc: '게임/애니/영화 등 2차창작 태그 없이 오리지널만 제작', color: 'sky' },

  // 개그/재미 신규 종
  { id: 'factory', emoji: '🏭', title: '공장장', description: '캐릭터 150명+', desc: '150명 이상의 수많은 캐릭터를 찍어낸 진정한 공장장', color: 'slate' },
  { id: 'obsessive', emoji: '👀', title: '집착광', description: '집착 태그 비율 높음', desc: '#집착 태그 캐릭터를 5개 이상 제작', color: 'violet' },
  { id: 'purelove', emoji: '💘', title: '오직 순애만', description: 'NTR 없이 순애 5개+', desc: 'NTR/NTL 관련 태그가 없으면서 #순애 태그 캐릭터를 5개 이상 제작', color: 'pink' },
  { id: 'lonely', emoji: '🗣️', title: '말상대 구함', description: '대화량 높으나 팔로워 없음', desc: '총 대화수 1,000 이상이나 팔로워가 0명인 고독한 영혼', color: 'slate' },
  { id: 'secret', emoji: '🤫', title: '신비주의', description: '비공개율 80% 이상', desc: '캐릭터 5개 이상이면서 상세 설정 비공개 비율이 80% 이상', color: 'slate' },
  { id: 'expensive', emoji: '💸', title: '비싼 몸', description: '대화/팔로워 비율 10,000 이상', desc: '팔로워수 대비 대화량이 압도적으로 높음 (비율 1만 이상)', color: 'gradient' },
  { id: '100m_zeta', emoji: '🌟', title: '1억제타', description: '대화수 1억 돌파', desc: '단일 캐릭터 대화수가 1억 회를 돌파한 경이로운 기록', color: 'rose' },
];

export const BADGE_DESCRIPTIONS = Object.fromEntries(
  BADGE_DEFINITIONS.map(b => [b.id, b.description])
);

export const BADGE_COLOR_MAP = {
  pink: { bg: 'bg-pink-500/15', border: 'border-pink-400/30', text: 'text-pink-300', dot: 'bg-pink-400' },
  red: { bg: 'bg-red-500/15', border: 'border-red-400/30', text: 'text-red-300', dot: 'bg-red-400' },
  blue: { bg: 'bg-blue-500/15', border: 'border-blue-400/30', text: 'text-blue-300', dot: 'bg-blue-400' },
  emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-400/30', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  yellow: { bg: 'bg-yellow-500/15', border: 'border-yellow-400/30', text: 'text-yellow-300', dot: 'bg-yellow-400' },
  amber: { bg: 'bg-amber-500/15', border: 'border-amber-400/30', text: 'text-amber-300', dot: 'bg-amber-400' },
  cyan: { bg: 'bg-cyan-500/15', border: 'border-cyan-400/30', text: 'text-cyan-300', dot: 'bg-cyan-400' },
  violet: { bg: 'bg-violet-500/15', border: 'border-violet-400/30', text: 'text-violet-300', dot: 'bg-violet-400' },
  indigo: { bg: 'bg-indigo-500/15', border: 'border-indigo-400/30', text: 'text-indigo-300', dot: 'bg-indigo-400' },
  purple: { bg: 'bg-purple-500/15', border: 'border-purple-400/30', text: 'text-purple-300', dot: 'bg-purple-400' },
  slate: { bg: 'bg-slate-500/15', border: 'border-slate-400/30', text: 'text-slate-300', dot: 'bg-slate-400' },
  teal: { bg: 'bg-teal-500/15', border: 'border-teal-400/30', text: 'text-teal-300', dot: 'bg-teal-400' },
  orange: { bg: 'bg-orange-500/15', border: 'border-orange-400/30', text: 'text-orange-300', dot: 'bg-orange-400' },
  sky: { bg: 'bg-sky-500/15', border: 'border-sky-400/30', text: 'text-sky-300', dot: 'bg-sky-400' },
  rose: { bg: 'bg-rose-500/15', border: 'border-rose-400/30', text: 'text-rose-300', dot: 'bg-rose-400' },
  lime: { bg: 'bg-lime-500/15', border: 'border-lime-400/30', text: 'text-lime-300', dot: 'bg-lime-400' },
  pink_dark: { bg: 'bg-pink-500/10', border: 'border-pink-500/20', text: 'text-pink-400', dot: 'bg-pink-500' }
};

/** 표시할 칭호 편집에서 고정(토글 불가)인 칭호 id */
export const FIXED_BADGE_IDS = ['sunae', 'ntr'];

const FANTASY_TAGS = ['판타지', '마법', '기사', '마왕', '용사', '엘프', '드래곤'];

/** Pill 스타일: recap(진하게) / profile(연하게) */
export function getMediaSet() {
  return MEDIA_SET;
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
  const dates = characters.map(c => c.createdAt || c.createdDate).filter(Boolean).map(d => toKST(d));
  const earliest = dates.length > 0 ? new Date(Math.min(...dates)) : null;
  const activityDays = earliest ? (toKST().getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24) : 0;
  const activityMonths = activityDays / 30;

  const list = [];
  const allTags = characters.flatMap(c => (c.hashtags || c.tags || []).map(t => t.toLowerCase()));
  const tagSet = new Set(allTags);
  const hasSunae = tagSet.has('순애');
  const ntrTags = ['ntr', 'ntl', '뺏기', '빼앗기', '뺏김', '빼앗김'];
  const hasNtr = ntrTags.some(t => tagSet.has(t));
  const unlimitedChars = characters.filter(c => c.unlimitedAllowed);

  const sunaeChars = charsWithTag(characters, '순애');

  list.push({ id: 'sunae', emoji: '💕', title: '순애보', desc: BADGE_DEFINITIONS.find(b => b.id === 'sunae')?.desc ?? '', color: 'pink', earned: hasSunae && !hasNtr, chars: sunaeChars });
  list.push({ id: 'ntr', emoji: '💔', title: '사랑 파괴자', desc: BADGE_DEFINITIONS.find(b => b.id === 'ntr')?.desc ?? '', color: 'red', earned: hasNtr, chars: charsWithAnyTag(characters, ntrTags) });
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
  list.push({ id: 'furry', emoji: '🐾', title: '털', desc: BADGE_DEFINITIONS.find(b => b.id === 'furry')?.desc ?? '', color: 'amber', earned: ['수인', '수인형', '퍼리', 'furry'].some(t => tagSet.has(t)), chars: charsWithAnyTag(characters, ['수인', '수인형', '퍼리', 'furry']) });
  list.push({ id: 'oneyear', emoji: '🎂', title: '벌써 1년', desc: BADGE_DEFINITIONS.find(b => b.id === 'oneyear')?.desc ?? '', color: 'emerald', earned: activityDays >= 365 });
  list.push({ id: 'military', emoji: '🎖️', title: '고인물', desc: BADGE_DEFINITIONS.find(b => b.id === 'military')?.desc ?? '', color: 'blue', earned: activityDays >= 548 });

  list.push({ id: 'fertile', emoji: '🌾', title: '다산의 상징', desc: BADGE_DEFINITIONS.find(b => b.id === 'fertile')?.desc ?? '', color: 'lime', earned: characters.length >= 100 });
  list.push({ id: 'factory', emoji: '🏭', title: '공장장', desc: BADGE_DEFINITIONS.find(b => b.id === 'factory')?.desc ?? '', color: 'slate', earned: characters.length >= 150 });
  list.push({ id: 'obsessive', emoji: '👀', title: '집착광', desc: BADGE_DEFINITIONS.find(b => b.id === 'obsessive')?.desc ?? '', color: 'violet', earned: tagSet.has('집착') && charsWithTag(characters, '집착').length >= 5, chars: charsWithTag(characters, '집착') });
  list.push({ id: 'purelove', emoji: '💘', title: '오직 순애만', desc: BADGE_DEFINITIONS.find(b => b.id === 'purelove')?.desc ?? '', color: 'pink', earned: !hasNtr && sunaeChars.length >= 5, chars: sunaeChars });
  list.push({ id: 'lonely', emoji: '🗣️', title: '말상대 구함', desc: BADGE_DEFINITIONS.find(b => b.id === 'lonely')?.desc ?? '', color: 'slate', earned: totalInteractions >= 1000 && followers === 0 });



  const privateCount = characters.filter(c => !c.isLongDescriptionPublic).length;
  const isSecret = characters.length >= 5 && (privateCount / characters.length) >= 0.8;
  list.push({ id: 'secret', emoji: '🤫', title: '신비주의', desc: BADGE_DEFINITIONS.find(b => b.id === 'secret')?.desc ?? '', color: 'slate', earned: isSecret });

  const followRatio = followers > 0 ? totalInteractions / followers : 0;
  list.push({ id: 'expensive', emoji: '💸', title: '비싼 몸', desc: BADGE_DEFINITIONS.find(b => b.id === 'expensive')?.desc ?? '', color: 'gradient', earned: followRatio >= 10000 });

  const zeta100MChars = characters.filter(c => (c.interactionCount || 0) >= 100000000);
  list.push({ id: '100m_zeta', emoji: '🌟', title: '1억제타', desc: BADGE_DEFINITIONS.find(b => b.id === '100m_zeta')?.desc ?? '', color: 'rose', earned: zeta100MChars.length > 0, chars: zeta100MChars.map(c => c.name) });

  list.push({ id: 'iljin', emoji: '🏀', title: '일진', desc: BADGE_DEFINITIONS.find(b => b.id === 'iljin')?.desc ?? '', color: 'orange', earned: tagSet.has('일진'), chars: charsWithTag(characters, '일진') });
  list.push({ id: 'jjindda', emoji: '🚶', title: '찐따', desc: BADGE_DEFINITIONS.find(b => b.id === 'jjindda')?.desc ?? '', color: 'slate', earned: tagSet.has('찐따'), chars: charsWithTag(characters, '찐따') });
  list.push({ id: 'hero', emoji: '🦸', title: '취미일 뿐', desc: BADGE_DEFINITIONS.find(b => b.id === 'hero')?.desc ?? '', color: 'amber', earned: tagSet.has('히어로'), chars: charsWithTag(characters, '히어로') });
  list.push({ id: 'academy', emoji: '🎓', title: '아카데미', desc: BADGE_DEFINITIONS.find(b => b.id === 'academy')?.desc ?? '', color: 'indigo', earned: tagSet.has('아카데미'), chars: charsWithTag(characters, '아카데미') });
  list.push({ id: 'hyeongwan', emoji: '🖤', title: '혐관', desc: BADGE_DEFINITIONS.find(b => b.id === 'hyeongwan')?.desc ?? '', color: 'slate', earned: tagSet.has('혐관'), chars: charsWithTag(characters, '혐관') });
  list.push({ id: 'pipye', emoji: '😵', title: '피폐', desc: BADGE_DEFINITIONS.find(b => b.id === 'pipye')?.desc ?? '', color: 'violet', earned: tagSet.has('피폐'), chars: charsWithTag(characters, '피폐') });
  list.push({ id: 'sihanbu', emoji: '💧', title: '시한부', desc: BADGE_DEFINITIONS.find(b => b.id === 'sihanbu')?.desc ?? '', color: 'red', earned: tagSet.has('시한부'), chars: charsWithTag(characters, '시한부') });
  list.push({ id: 'guwon', emoji: '🩹', title: '구원', desc: BADGE_DEFINITIONS.find(b => b.id === 'guwon')?.desc ?? '', color: 'emerald', earned: tagSet.has('구원'), chars: charsWithTag(characters, '구원') });

  const MEDIA_SET = new Set([
    '블루아카이브', '원신', '명일방주', '붕괴', '페이트', '우마무스메', '명조', '니케',
    '블루아카', '롤', '리그오브레전드', '코난', '주술회전', '하이큐', '귀멸의칼날',
    '해리포터', '마블', '디시', 'dc'
  ]);
  const hasNo2nd = !characters.some(c => (c.hashtags || c.tags || []).some(t => MEDIA_SET.has(t.toLowerCase())));
  list.push({ id: 'original', emoji: '✨', title: '오리지널', desc: BADGE_DEFINITIONS.find(b => b.id === 'original')?.desc ?? '', color: 'sky', earned: hasNo2nd && characters.length > 0 });

  return list;
}

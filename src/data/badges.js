import { toKST } from '../utils/tierCalculator';
import mediaFranchises from './mediaFranchises.json';

const MEDIA_SET = new Set([
  ...mediaFranchises.mobileGames,
  ...mediaFranchises.anime,
  ...mediaFranchises.movies,
  ...mediaFranchises.roblox,
  ...mediaFranchises.tags,
].map(t => t.toLowerCase()));

/** 칭호 메타: id, emoji, title, description, desc, color, category */
export const BADGE_DEFINITIONS = [
  // ─── 총 대화량 마일스톤 (category: 'interaction') ───

  { id: '1k',        emoji: '🌱', title: '새싹',           description: '총 대화 1천+',   desc: '총 대화수 1,000 이상',          color: 'blue',    category: 'interaction' },
  { id: '10k',       emoji: '✨', title: 'OVER 10000',    description: '총 대화 1만+',   desc: '총 대화수 10,000 이상',         color: 'cyan',    category: 'interaction' },
  { id: '100k',      emoji: '🔥', title: '성장 중',         description: '총 대화 10만+',  desc: '총 대화수 100,000 이상',        color: 'orange',  category: 'interaction' },
  { id: '1m',        emoji: '💬', title: '밀리언',           description: '총 대화 100만+', desc: '총 대화수 1,000,000 이상',      color: 'amber',   category: 'interaction' },
  { id: '10m',       emoji: '🎬', title: '천만관객',         description: '총 대화 1천만+', desc: '총 대화수 10,000,000 이상',     color: 'yellow',  category: 'interaction' },
  { id: '100m_total',emoji: '🐷', title: '돼지',             description: '총 대화 1억+',   desc: '총 대화수 100,000,000 이상',    color: 'violet',  category: 'interaction' },

  // ─── 단일 캐릭터 대화량 마일스톤 (category: 'char_interaction') ───
  { id: 'char_10k',  emoji: '📈', title: '1만 캐릭터',   description: '캐릭터 1만 대화', desc: '단일 캐릭터 대화수 10,000 이상',     color: 'teal',    category: 'char_interaction' },
  { id: 'char_100k', emoji: '📊', title: '10만 캐릭터',  description: '캐릭터 10만 대화',desc: '단일 캐릭터 대화수 100,000 이상',    color: 'blue',    category: 'char_interaction' },
  { id: 'char_500k', emoji: '🥇', title: '골든 디스크', description: '캐릭터 50만 대화',desc: '단일 캐릭터 대화수 500,000 이상',    color: 'yellow',  category: 'char_interaction' },
  { id: 'platinum',  emoji: '💿', title: '플래티넘 디스크',  description: '캐릭터 100만 대화',desc: '단일 캐릭터 대화수 1,000,000 이상', color: 'slate',   category: 'char_interaction' },
  { id: 'char_10m',  emoji: '🎤', title: '아이돌',           description: '캐릭터 1천만 대화',desc: '단일 캐릭터 대화수 10,000,000 이상', color: 'pink',  category: 'char_interaction' },
  { id: '100m_zeta', emoji: '🌟', title: '1억 제타',          description: '캐릭터 1억 대화', desc: '단일 캐릭터 대화수 100,000,000 이상',color: 'rose',    category: 'char_interaction' },
  { id: 'hattrick',  emoji: '🎩', title: '해트트릭',          description: '100만 캐릭터 3개+',desc: '100만 이상 대화량 캐릭터 3개 이상 보유',color: 'indigo', category: 'char_interaction' },

  // ─── 팔로워 ───
  { id: 'follower_100',  emoji: '🎙️', title: '지망생',   description: '팔로워 100+',  desc: '팔로워 100명 이상',       color: 'blue',    category: 'follower' },
  { id: 'follower_1k',   emoji: '⭐', title: '스타',     description: '팔로워 1천+',  desc: '팔로워 1,000명 이상',     color: 'amber',   category: 'follower' },
  { id: 'follower_5k',   emoji: '🌠', title: '대스타',   description: '팔로워 5천+',  desc: '팔로워 5,000명 이상',     color: 'yellow',  category: 'follower' },
  { id: 'superstar',     emoji: '🌌', title: '우주대스타', description: '팔로워 1만+', desc: '팔로워 10,000명 이상',    color: 'gradient', category: 'follower' },

  // ─── 제작 이력 ───
  { id: 'fertile',   emoji: '🌾', title: '다산의 상징', description: '캐릭터 100명+', desc: '100명 이상의 캐릭터 제작', color: 'lime',  category: 'creation' },
  { id: 'factory',   emoji: '🏭', title: '공장장',      description: '캐릭터 150명+', desc: '150명 이상의 캐릭터를 제작한 공장장', color: 'slate', category: 'creation' },
  { id: 'secret',    emoji: '🤫', title: '신비주의',    description: '비공개율 80%+', desc: '캐릭터 5개 이상이면서 상세 설정 비공개 비율 80% 이상', color: 'slate', category: 'creation' },

  // ─── 기타 (interaction 특이 업적) ───
  { id: 'lonely',    emoji: '🗣️', title: '말상대 구함', description: '대화 있으나 팔로워 없음', desc: '총 대화수 1,000 이상이나 팔로워가 0명', color: 'slate',    category: 'interaction' },
  { id: 'expensive', emoji: '💸', title: '비싼 몸',     description: '대화/팔로워 비율 1만+',  desc: '팔로워 대비 대화량이 압도적 (비율 10,000 이상)',color: 'gradient', category: 'interaction' },

  // ─── 태그 ───
  { id: 'sunae',     emoji: '💕', title: '순애보',      description: '순애 태그, NTR 없음',    desc: '#순애 태그가 있으며 NTR/NTL 없음',         color: 'pink',    category: 'tag' },
  { id: 'ntr',       emoji: '💔', title: '사랑 파괴자', description: 'NTR/NTL 등',             desc: '#NTR, #NTL, #뺏기, #빼앗기 태그 보유',     color: 'red',     category: 'tag' },
  { id: 'fantasy',   emoji: '🗡️', title: '판타지',      description: '판타지·마법·기사 등',    desc: '#판타지, #마법, #기사, #마왕 등 태그 보유', color: 'indigo',  category: 'tag' },
  { id: 'cyber',     emoji: '⚡', title: '사펑',         description: '사이버펑크',              desc: '#사이버펑크 태그 보유',                     color: 'gradient',category: 'tag' },
  { id: 'mesu',      emoji: '🩷', title: '허접',         description: '메스가키·소악마·도발',     desc: '#메스가키, #소악마, #도발 태그 보유',       color: 'pink',    category: 'tag' },
  { id: 'unlimit',   emoji: '🔮', title: '언리밋',       description: 'Unlimited 설정',          desc: 'Unlimited 설정된 캐릭터 보유',              color: 'violet',  category: 'tag' },
  { id: 'furry',     emoji: '🐾', title: '털',           description: '퍼리·수인',               desc: '#퍼리, #수인 태그 보유',                    color: 'amber',   category: 'tag' },
  { id: 'obsessive', emoji: '👀', title: '집착광',       description: '집착 태그 5개+',          desc: '#집착 태그 캐릭터 5개 이상 제작',           color: 'violet',  category: 'tag' },
  { id: 'purelove',  emoji: '💘', title: '오직 순애만',  description: 'NTR 없이 순애 5개+',      desc: 'NTR 없이 #순애 캐릭터 5개 이상',           color: 'pink',    category: 'tag' },
  { id: 'iljin',     emoji: '🏀', title: '체육 안가고 뭐함', description: '#일진 태그',           desc: '캐릭터 중 #일진 태그 보유',                 color: 'orange',  category: 'tag' },
  { id: 'jjindda',   emoji: '🚶', title: '찐따',         description: '#찐따 태그',              desc: '캐릭터 중 #찐따 태그 보유',                 color: 'slate',   category: 'tag' },
  { id: 'hero',      emoji: '🦸', title: '취미일 뿐',   description: '#히어로 태그',             desc: '캐릭터 중 #히어로 태그 보유',               color: 'amber',   category: 'tag' },
  { id: 'academy',   emoji: '🎓', title: '아카데미',     description: '#아카데미 태그',           desc: '캐릭터 중 #아카데미 태그 보유',             color: 'indigo',  category: 'tag' },
  { id: 'hyeongwan', emoji: '🖤', title: '혐관',         description: '#혐관 태그',              desc: '캐릭터 중 #혐관 태그 보유',                 color: 'slate',   category: 'tag' },
  { id: 'pipye',     emoji: '😵', title: '피폐',         description: '#피폐 태그',              desc: '캐릭터 중 #피폐 태그 보유',                 color: 'violet',  category: 'tag' },
  { id: 'sihanbu',   emoji: '💧', title: '시한부',       description: '#시한부 태그',            desc: '캐릭터 중 #시한부 태그 보유',               color: 'red',     category: 'tag' },
  { id: 'guwon',     emoji: '🩹', title: '구원',         description: '#구원 태그',              desc: '캐릭터 중 #구원 태그 보유',                 color: 'emerald', category: 'tag' },
  { id: 'saikai',    emoji: '💌', title: 'S is not..', description: '#재회 태그',              desc: '캐릭터 중 #재회 태그 보유. ',    color: 'rose',    category: 'tag' },
  { id: 'robot',     emoji: '🤖', title: '텅텅이',       description: '#로봇/#안드로이드 태그',  desc: '캐릭터 중 #로봇, #안드로이드 태그 보유.', color: 'slate',   category: 'tag' },
    { id: 'magicalgirl', emoji: '🌙', title: '나와 계약해서..', description: '#마법소녀 태그',     desc: '캐릭터 중 #마법소녀 태그 보유. 같이 마법소녀 할래요?', color: 'violet', category: 'tag' },
  { id: 'harem',     emoji: '🌸', title: '판타지',          description: '#하렘 태그',              desc: '캐릭터 중 #하렘, #역하렘 태그 보유',        color: 'pink',    category: 'tag' },
  { id: 'cute',      emoji: '🍒', title: '귀여움은 정의다', description: '#귀여움 태그',             desc: '캐릭터 중 #귀여움 태그 보유.',    color: 'rose',    category: 'tag' },
  { id: 'soldier',   emoji: '🎖️', title: '우리의 결의',     description: '#군인 태그',              desc: '캐릭터 중 #군인, #군대 태그 보유',          color: 'slate',   category: 'tag' },
  { id: 'lily',      emoji: '🌷', title: '난입은 범죄',     description: '#백합 태그',              desc: '캐릭터 중 #백합 태그 보유. GL 존중',        color: 'pink',    category: 'tag' },
  { id: 'original',  emoji: '✨', title: '오리지널',     description: '2차창작 태그 없음',        desc: '게임/애니/영화 2차창작 없이 오리지널만 제작', color: 'sky',     category: 'tag' },

  { id: 'boss',      emoji: '😎', title: '굿데이 보스',     description: '#보스 태그',              desc: '캐릭터 중 #보스 태그 보유.',        color: 'amber',   category: 'tag' },
  { id: 'glasses',   emoji: '👓', title: '미소녀의 요소',   description: '#안경 태그',              desc: '캐릭터 중 #안경 태그 보유',                 color: 'indigo',  category: 'tag' },
  // ─── 개그 태그 (bonus) ───
  { id: 'truck',     emoji: '🚛', title: '트럭 주의',   description: '이세계/환생/회귀 태그',   desc: '#이세계, #환생, #회귀 등 태그 보유. "터엉-" ', color: 'orange',  category: 'tag' },
  { id: 'yethwi',    emoji: '🔄', title: '또 회귀함',   description: '#회귀 태그',               desc: '#회귀 태그 보유. 오늘도 회귀하는 당신', color: 'violet',  category: 'tag' },
  { id: 'healer',    emoji: '💊', title: '전문 힐러',   description: '#치유/힐링 태그',    desc: '#치유, #힐링 태그 보유.', color: 'emerald', category: 'tag' },

  // ─── 활동 기간 ───
  { id: 'newbie',    emoji: '🌱', title: '뉴비',         description: '활동 3개월 이하', desc: '활동 기간 3개월 이하',          color: 'emerald', category: 'activity' },
  { id: 'oneyear',   emoji: '🎂', title: '벌써 1년',     description: '활동 1년 이상',   desc: '활동 기간 1년(365일) 이상',    color: 'emerald', category: 'activity' },
  { id: 'military',  emoji: '🎖️', title: '고인물',       description: '활동 1년 6개월+', desc: '활동 기간 1년 6개월(548일) 이상', color: 'blue',  category: 'activity' },
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
  const maxSingleChar = characters.reduce((max, c) => Math.max(max, c.interactionCount || 0), 0);

  const list = [];
  const allTags = characters.flatMap(c => (c.hashtags || c.tags || []).map(t => t.toLowerCase()));
  const tagSet = new Set(allTags);
  const hasSunae = tagSet.has('순애');
  const ntrTags = ['ntr', 'ntl', '뺏기', '빼앗기', '뺏김', '빼앗김'];
  const hasNtr = ntrTags.some(t => tagSet.has(t));
  const unlimitedChars = characters.filter(c => c.unlimitedAllowed);
  const sunaeChars = charsWithTag(characters, '순애');

  // ─── BADGE_DEFINITIONS 빠른 접근용 맵 (id → definition) ───
  const DEFS = Object.fromEntries(BADGE_DEFINITIONS.map(b => [b.id, b]));
  const D = (id) => DEFS[id] || {};

  // ─── 총 대화량 마일스톤 ───
  list.push({ id: '1k',         emoji: D('1k').emoji,         title: D('1k').title,         desc: D('1k').desc ?? '',         color: 'blue',    earned: totalInteractions >= 1000,       progress: totalInteractions < 1000       ? { current: totalInteractions, max: 1000,        label: '총 대화수' } : undefined });
  list.push({ id: '10k',        emoji: D('10k').emoji,        title: D('10k').title,        desc: D('10k').desc ?? '',        color: 'cyan',    earned: totalInteractions >= 10000,      progress: totalInteractions < 10000      ? { current: totalInteractions, max: 10000,       label: '총 대화수' } : undefined });
  list.push({ id: '100k',       emoji: D('100k').emoji,       title: D('100k').title,       desc: D('100k').desc ?? '',       color: 'orange',  earned: totalInteractions >= 100000,     progress: totalInteractions < 100000     ? { current: totalInteractions, max: 100000,      label: '총 대화수' } : undefined });
  list.push({ id: '1m',         emoji: D('1m').emoji,         title: D('1m').title,         desc: D('1m').desc ?? '',         color: 'amber',   earned: totalInteractions >= 1000000,    progress: totalInteractions < 1000000    ? { current: totalInteractions, max: 1000000,     label: '총 대화수' } : undefined });
  list.push({ id: '10m',        emoji: D('10m').emoji,        title: D('10m').title,        desc: D('10m').desc ?? '',        color: 'yellow',  earned: totalInteractions >= 10000000,   progress: totalInteractions < 10000000   ? { current: totalInteractions, max: 10000000,    label: '총 대화수' } : undefined });
  list.push({ id: '100m_total', emoji: D('100m_total').emoji, title: D('100m_total').title, desc: D('100m_total').desc ?? '', color: 'violet',  earned: totalInteractions >= 100000000,  progress: totalInteractions < 100000000  ? { current: totalInteractions, max: 100000000,   label: '총 대화수' } : undefined });
  list.push({ id: 'lonely',     emoji: D('lonely').emoji,     title: D('lonely').title,     desc: D('lonely').desc ?? '',     color: 'slate',    earned: totalInteractions >= 1000 && followers === 0 });
  list.push({ id: 'expensive',  emoji: D('expensive').emoji,  title: D('expensive').title,  desc: D('expensive').desc ?? '',  color: 'gradient', earned: followers > 0 ? (totalInteractions / followers) >= 10000 : false });

  // ─── 단일 캐릭터 대화량 마일스톤 ───
  list.push({ id: 'char_10k',  emoji: D('char_10k').emoji,  title: D('char_10k').title,  desc: D('char_10k').desc ?? '',  color: 'teal',   earned: maxSingleChar >= 10000,   progress: maxSingleChar < 10000   ? { current: maxSingleChar, max: 10000,   label: '최고 캐릭터 대화수' } : undefined });
  list.push({ id: 'char_100k', emoji: D('char_100k').emoji, title: D('char_100k').title, desc: D('char_100k').desc ?? '', color: 'blue',   earned: maxSingleChar >= 100000,  progress: maxSingleChar < 100000  ? { current: maxSingleChar, max: 100000,  label: '최고 캐릭터 대화수' } : undefined });
  list.push({ id: 'char_500k', emoji: D('char_500k').emoji, title: D('char_500k').title, desc: D('char_500k').desc ?? '', color: 'yellow', earned: maxSingleChar >= 500000,  progress: maxSingleChar < 500000  ? { current: maxSingleChar, max: 500000,  label: '최고 캐릭터 대화수' } : undefined });
  const platinumChars = charactersWithInteraction(characters, 1000000);
  list.push({ id: 'platinum',  emoji: D('platinum').emoji,  title: D('platinum').title,  desc: D('platinum').desc ?? '',  color: 'slate',  earned: platinumChars.length > 0,    chars: platinumChars.map(c => c.name), progress: platinumChars.length === 0 ? { current: maxSingleChar, max: 1000000, label: '최고 캐릭터 대화수' } : undefined });
  list.push({ id: 'char_10m',  emoji: D('char_10m').emoji,  title: D('char_10m').title,  desc: D('char_10m').desc ?? '',  color: D('char_10m').color || 'teal', earned: maxSingleChar >= 10000000, progress: maxSingleChar < 10000000 ? { current: maxSingleChar, max: 10000000, label: '최고 캐릭터 대화수' } : undefined });
  const zeta100MChars = characters.filter(c => (c.interactionCount || 0) >= 100000000);
  list.push({ id: '100m_zeta', emoji: D('100m_zeta').emoji, title: D('100m_zeta').title, desc: D('100m_zeta').desc ?? '', color: 'rose',   earned: zeta100MChars.length > 0, chars: zeta100MChars.map(c => c.name), progress: zeta100MChars.length === 0 && maxSingleChar > 0 ? { current: maxSingleChar, max: 100000000, label: '최고 캐릭터 대화수' } : undefined });
  const hattrickChars = charactersWithInteraction(characters, 1000000);
  list.push({ id: 'hattrick',  emoji: D('hattrick').emoji,  title: D('hattrick').title,  desc: D('hattrick').desc ?? '',  color: 'indigo', earned: hattrickChars.length >= 3, chars: hattrickChars.map(c => c.name), progress: hattrickChars.length < 3 ? { current: hattrickChars.length, max: 3, label: '100만+ 캐릭터' } : undefined });

  // ─── 팔로워 ───
  list.push({ id: 'follower_100', emoji: D('follower_100').emoji, title: D('follower_100').title, desc: D('follower_100').desc ?? '', color: 'blue',     earned: followers >= 100,   progress: followers < 100   ? { current: followers, max: 100,   label: '팔로워' } : undefined });
  list.push({ id: 'follower_1k',  emoji: D('follower_1k').emoji,  title: D('follower_1k').title,  desc: D('follower_1k').desc ?? '',  color: 'amber',    earned: followers >= 1000,  progress: followers < 1000  ? { current: followers, max: 1000,  label: '팔로워' } : undefined });
  list.push({ id: 'follower_5k',  emoji: D('follower_5k').emoji,  title: D('follower_5k').title,  desc: D('follower_5k').desc ?? '',  color: 'yellow',   earned: followers >= 5000,  progress: followers < 5000  ? { current: followers, max: 5000,  label: '팔로워' } : undefined });
  list.push({ id: 'superstar',    emoji: D('superstar').emoji,    title: D('superstar').title,    desc: D('superstar').desc ?? '',    color: 'gradient', earned: followers >= 10000, progress: followers < 10000 ? { current: followers, max: 10000, label: '팔로워' } : undefined });

  // ─── 제작 이력 ───
  list.push({ id: 'fertile',   emoji: '🌾', title: '다산의 상징', desc: BADGE_DEFINITIONS.find(b => b.id === 'fertile')?.desc ?? '',   color: 'lime',  earned: characters.length >= 100, progress: characters.length < 100 ? { current: characters.length, max: 100, label: '캐릭터' } : undefined });
  list.push({ id: 'factory',   emoji: '🏭', title: '공장장',      desc: BADGE_DEFINITIONS.find(b => b.id === 'factory')?.desc ?? '',   color: 'slate', earned: characters.length >= 150, progress: characters.length < 150 ? { current: characters.length, max: 150, label: '캐릭터' } : undefined });
  const privateCount = characters.filter(c => !c.isLongDescriptionPublic).length;
  list.push({ id: 'secret',    emoji: '🤫', title: '신비주의',    desc: BADGE_DEFINITIONS.find(b => b.id === 'secret')?.desc ?? '',    color: 'slate', earned: characters.length >= 5 && (privateCount / characters.length) >= 0.8 });

  // ─── 태그 ───
  list.push({ id: 'sunae',     emoji: '💕', title: '순애보',      desc: BADGE_DEFINITIONS.find(b => b.id === 'sunae')?.desc ?? '',     color: 'pink',    earned: hasSunae && !hasNtr, chars: sunaeChars });
  list.push({ id: 'ntr',       emoji: '💔', title: '사랑 파괴자', desc: BADGE_DEFINITIONS.find(b => b.id === 'ntr')?.desc ?? '',       color: 'red',     earned: hasNtr, chars: charsWithAnyTag(characters, ntrTags) });
  const fantasyChars = charsWithAnyTag(characters, ['판타지', '마법', '기사', '마왕', '용사', '엘프', '드래곤']);
  list.push({ id: 'fantasy',   emoji: '🗡️', title: '판타지',      desc: BADGE_DEFINITIONS.find(b => b.id === 'fantasy')?.desc ?? '',   color: 'indigo',  earned: fantasyChars.length > 0, chars: fantasyChars });
  const cyberChars = charsWithAnyTag(characters, ['사이버펑크', 'cyberpunk']);
  list.push({ id: 'cyber',     emoji: '⚡', title: '사펑',         desc: BADGE_DEFINITIONS.find(b => b.id === 'cyber')?.desc ?? '',     color: 'gradient',earned: cyberChars.length > 0, chars: cyberChars });
  const mesuChars = charsWithAnyTag(characters, ['메스가키', '소악마', '도발']);
  list.push({ id: 'guwon',     emoji: '🩹', title: '구원',         desc: BADGE_DEFINITIONS.find(b => b.id === 'guwon')?.desc ?? '',    color: 'emerald', earned: tagSet.has('구원'), chars: charsWithTag(characters, '구원') });

  const bossChars = charsWithTag(characters, '보스');
  list.push({ id: 'boss',    emoji: '😎', title: '굿데이 보스',   desc: BADGE_DEFINITIONS.find(b => b.id === 'boss')?.desc ?? '',    color: 'amber',  earned: bossChars.length > 0,    chars: bossChars });
  const glassesChars = charsWithTag(characters, '안경');
  list.push({ id: 'glasses', emoji: '👓', title: '미소녀의 요소', desc: BADGE_DEFINITIONS.find(b => b.id === 'glasses')?.desc ?? '', color: 'indigo', earned: glassesChars.length > 0, chars: glassesChars });

  // ─── 개그 태그 (bonus) ───
  const truckChars = charsWithAnyTag(characters, ['이세계', '환생', '회귀', '환생이세계']);
  list.push({ id: 'truck',  emoji: '🚛', title: '트럭 주의',   desc: BADGE_DEFINITIONS.find(b => b.id === 'truck')?.desc ?? '',  color: 'orange',  earned: truckChars.length > 0, chars: truckChars });
  const yethwiChars = charsWithTag(characters, '회귀');
  list.push({ id: 'yethwi', emoji: '🔄', title: '또 회귀함',   desc: BADGE_DEFINITIONS.find(b => b.id === 'yethwi')?.desc ?? '', color: 'violet',  earned: yethwiChars.length > 0, chars: yethwiChars });
  const healerChars = charsWithAnyTag(characters, ['치유', '힐링']);
  list.push({ id: 'healer', emoji: '💊', title: '전문 힐러',   desc: BADGE_DEFINITIONS.find(b => b.id === 'healer')?.desc ?? '', color: 'emerald', earned: healerChars.length > 0, chars: healerChars });

  const saikaiChars = charsWithTag(characters, '재회');
  list.push({ id: 'saikai', emoji: '💌', title: 'S is not..', desc: BADGE_DEFINITIONS.find(b => b.id === 'saikai')?.desc ?? '', color: 'rose',  earned: saikaiChars.length > 0, chars: saikaiChars });
  const robotChars = charsWithAnyTag(characters, ['로봇', '안드로이드']);
  list.push({ id: 'robot',  emoji: '🤖', title: '텅텅이',       desc: BADGE_DEFINITIONS.find(b => b.id === 'robot')?.desc ?? '',  color: 'slate', earned: robotChars.length > 0,  chars: robotChars });

    const magicalChars = charsWithTag(characters, '마법소녀');
  list.push({ id: 'magicalgirl', emoji: '🌙', title: '나와 계약해서..', desc: BADGE_DEFINITIONS.find(b => b.id === 'magicalgirl')?.desc ?? '', color: 'violet', earned: magicalChars.length > 0, chars: magicalChars });
  const haremChars = charsWithAnyTag(characters, ['하렘', '역하렘']);
  list.push({ id: 'harem',  emoji: '🌸', title: '판타지',          desc: BADGE_DEFINITIONS.find(b => b.id === 'harem')?.desc ?? '',       color: 'pink',  earned: haremChars.length > 0, chars: haremChars });
  const cuteChars = charsWithTag(characters, '귀여움');
  list.push({ id: 'cute',   emoji: '🍒', title: '귀여움은 정의다', desc: BADGE_DEFINITIONS.find(b => b.id === 'cute')?.desc ?? '',         color: 'rose',  earned: cuteChars.length > 0,   chars: cuteChars });
  const soldierChars = charsWithAnyTag(characters, ['군인', '군대']);
  list.push({ id: 'soldier',emoji: '🎖️', title: '우리의 결의',     desc: BADGE_DEFINITIONS.find(b => b.id === 'soldier')?.desc ?? '',      color: 'slate', earned: soldierChars.length > 0, chars: soldierChars });
  const lilyChars = charsWithTag(characters, '백합');
  list.push({ id: 'lily',   emoji: '🌷', title: '난입은 범죄',     desc: BADGE_DEFINITIONS.find(b => b.id === 'lily')?.desc ?? '',          color: 'pink',  earned: lilyChars.length > 0,   chars: lilyChars });

  const hasNo2nd = !characters.some(c => (c.hashtags || c.tags || []).some(t => MEDIA_SET.has(t.toLowerCase())));
  list.push({ id: 'original', emoji: '✨', title: '오리지널', desc: BADGE_DEFINITIONS.find(b => b.id === 'original')?.desc ?? '', color: 'sky', earned: hasNo2nd && characters.length > 0 });


  // BADGE_DEFINITIONS에서 category 필드 매핑 (list.push마다 category를 넣지 않았으므로 여기서 보완)
  const BADGE_CAT_MAP = Object.fromEntries(BADGE_DEFINITIONS.map(b => [b.id, b.category || 'tag']));
  return list.map(item => ({ ...item, category: BADGE_CAT_MAP[item.id] || 'tag' }));
}

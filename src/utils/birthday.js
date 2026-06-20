import { toKST } from './tierCalculator';

/**
 * 오늘(KST 기준)이 제작 기념일인 캐릭터를 추려서 반환한다.
 *
 * "생일" = createdAt(또는 createdDate)의 월/일이 오늘의 월/일과 일치.
 * 연도는 보지 않으므로 매년 그날 다시 배너가 뜬다.
 *
 * @param {Array<object>} characters
 * @returns {Array<object & { birthDate: Date, age: number }>}
 *   age = 올해 연도 - 제작 연도 (올해 만든 캐릭터면 0)
 */
export function getBirthdayCharacters(characters) {
  if (!Array.isArray(characters)) return [];

  const today = toKST();
  const tMonth = today.getMonth();
  const tDate = today.getDate();
  const tYear = today.getFullYear();

  return characters
    .map((c) => {
      const raw = c?.createdAt || c?.createdDate;
      if (!raw) return null;

      const d = toKST(raw);
      if (Number.isNaN(d.getTime())) return null;
      if (d.getMonth() !== tMonth || d.getDate() !== tDate) return null;

      return { ...c, birthDate: d, age: tYear - d.getFullYear() };
    })
    .filter(Boolean)
    // 오래된(나이 많은) 캐릭터를 주인공으로 앞세운다.
    .sort((a, b) => b.age - a.age);
}

/** 생일 카드 서브라인용 한국어 날짜 포맷: "2024년 6월 20일" */
export function formatBirthDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

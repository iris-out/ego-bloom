import React, { useState, useEffect } from 'react';
import TagBubbleCard from './TagBubbleCard';

const TABS = [
  {
    key: 'romance',
    label: '로맨스 / 감정',
    cards: [
      { key: '순애',      label: '순애',       subLabel: '순수 로맨스' },
      { key: 'bl',        label: 'BL',         subLabel: 'Boys Love' },
      { key: 'gl',        label: 'GL',         subLabel: 'Girls Love' },
      { key: 'ntr_agg',   label: 'NTR계열',    subLabel: '빼앗김 · 불륜 계열' },
      { key: 'hpj_agg',   label: '후/피/집',   subLabel: '후회 · 피폐 · 집착' },
      { key: 'harem_agg', label: '하렘/역하렘', subLabel: '하렘 · 역하렘' },
      { key: '혐관',      label: '혐관',       subLabel: '혐오 관계물' },
      { key: '능글',      label: '능글',       subLabel: '능글맞은 상대' },
      { key: '소꿉친구',  label: '소꿉친구',   subLabel: '소꿉친구 설정' },
      { key: '배신',      label: '배신',       subLabel: '배신 서사' },
      { key: '오지콤',    label: '오지콤',     subLabel: '오지랖 콤플렉스' },
      { key: '짝사랑',    label: '짝사랑',     subLabel: '짝사랑 설정' },
    ],
  },
  {
    key: 'genre',
    label: '세계관 / 장르',
    cards: [
      { key: 'fantasy_agg', label: '판타지계열',      subLabel: '판타지 · 현대판타지' },
      { key: 'isekai_agg',  label: '이세계/전생/회귀', subLabel: '이세계 · 전생 · 회귀 · 빙의' },
      { key: '무협',         label: '무협',            subLabel: '무협 · 무가' },
      { key: 'sf',           label: 'SF',              subLabel: 'SF · 사이버펑크' },
      { key: 'thriller_agg', label: '스릴러/공포',     subLabel: '스릴러 · 공포' },
      { key: '학원',          label: '학원',            subLabel: '학원물' },
      { key: '현대',          label: '현대',            subLabel: '현대 배경' },
      { key: '수인',          label: '수인',            subLabel: '수인 캐릭터' },
    ],
  },
  {
    key: 'setting',
    label: '설정 / 상황',
    cards: [
      { key: '재벌',    label: '재벌',    subLabel: '재벌 · 부잣집' },
      { key: '연예계',  label: '연예계',  subLabel: '아이돌 · 배우' },
      { key: '게임',    label: '게임',    subLabel: '게임 · 가상현실' },
      { key: '일상',    label: '일상',    subLabel: '일상 · 힐링' },
      { key: '대학생',  label: '대학생',  subLabel: '대학교 배경' },
      { key: '일진',    label: '일진',    subLabel: '일진 · 학교폭력' },
      { key: '조직',    label: '조직',    subLabel: '조직 · 마피아' },
      { key: '정략결혼', label: '정략결혼', subLabel: '정략결혼 설정' },
    ],
  },
];

const TIME_WINDOWS = ['6h', '12h', '24h', '48h'];

export default function TagBubbleSection({ tagTrend = {}, tagScores = {}, tagScoresDelta = {}, activeTabOverride = null }) {
  const [timeWindow, setTimeWindow] = useState('6h');
  const [activeTab, setActiveTab] = useState('romance');
  const [showFormula, setShowFormula] = useState(false);

  useEffect(() => {
    if (activeTabOverride && TABS.some(t => t.key === activeTabOverride)) {
      setActiveTab(activeTabOverride);
    }
  }, [activeTabOverride]);

  const currentCards = TABS.find(t => t.key === activeTab)?.cards || [];

  return (
    <div className="flex flex-col gap-3">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold tracking-widest text-white/50 uppercase">태그 트렌드</span>
        <div className="flex items-center gap-2">
          {TIME_WINDOWS.map(w => (
            <button
              key={w}
              onClick={() => setTimeWindow(w)}
              className={`px-3 py-1 text-[12px] font-semibold transition-all rounded ${
                timeWindow === w
                  ? 'bg-[rgba(74,127,255,0.2)] text-white border border-[rgba(74,127,255,0.5)]'
                  : 'bg-white/[0.07] text-white/40 border border-white/[0.10] hover:bg-white/[0.12]'
              }`}
            >
              {w}
            </button>
          ))}
          <div className="relative">
            <button
              onMouseEnter={() => setShowFormula(true)}
              onMouseLeave={() => setShowFormula(false)}
              className="text-white/25 hover:text-white/55 transition-colors text-[12px]"
            >
              ⓘ
            </button>
            {showFormula && (
              <div className="absolute right-0 top-5 z-50 w-72 rounded bg-[#1a1f2e] border border-white/10 p-3 text-[11px] leading-relaxed shadow-xl">
                <p className="font-bold text-white/75 mb-1.5">점수 산정 방식</p>
                <p className="text-white/50">
                  해당 태그 캐릭터들의{' '}
                  <span className="text-white/75">채팅 수(로그 보정)</span>에 랭킹 가중치를 곱해 산출합니다. 극단적으로 크거나 작은 플롯의 영향을 완화합니다.
                </p>
                <div className="mt-2 pt-2 border-t border-white/10 text-white/40 space-y-0.5">
                  <p>• 트렌딩 진입 시 최대 <span className="text-white/60">×2.0</span> 가산</p>
                  <p>• 베스트 진입 시 최대 <span className="text-white/60">×1.0</span> 가산</p>
                  <p>• 신작 진입 시 최대 <span className="text-white/60">×0.5</span> 가산</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 장르 탭 */}
      <div className="flex border-b border-white/[0.08]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-[13px] font-semibold transition-all ${
              activeTab === tab.key
                ? 'text-[#4A7FFF] border-b-2 border-[#4A7FFF] -mb-px'
                : 'text-white/35 hover:text-white/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4열 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {currentCards.map(card => (
          <TagBubbleCard
            key={card.key}
            label={card.label}
            subLabel={card.subLabel}
            dataPoints={tagTrend[card.key] || []}
            currentScore={tagScores?.[card.key] ?? 0}
            timeWindow={timeWindow}
          />
        ))}
      </div>
    </div>
  );
}

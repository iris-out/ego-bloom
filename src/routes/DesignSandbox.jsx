import { useState } from 'react';
import { CREATOR_TIERS, CHAR_TIERS } from '../design/tiers';
import TierMark from '../components/ui/TierMark';
import RarityTab from '../components/ui/RarityTab';
import CharCard from '../components/ui/CharCard';
import PlayerCard from '../components/ui/PlayerCard';
import Num from '../components/ui/Num';
import Delta from '../components/ui/Delta';
import Sparkline from '../components/ui/Sparkline';
import Segmented from '../components/ui/Segmented';
import Modal from '../components/ui/Modal';
import ThemeToggle from '../components/ui/ThemeToggle';

const MOCK_CHARS = [
  { name: '레이니 아스트라', rarity: 'x', count: 27200000, creator: '@moonveil', rank: 1 },
  { name: '카이토', rarity: 'sr', count: 4230000, creator: '@duskforge', rank: 2 },
  { name: '세라핌', rarity: 'r', count: 182000, creator: '@aria_k', rank: 3 },
  { name: '노바', rarity: 's', count: 24500, creator: '@lumen' },
  { name: '테오', rarity: 'a', count: 3200, creator: '@teo_studio' },
  { name: '픽시', rarity: 'b', count: 420, creator: '@pixel_dot' },
];

const MOCK_SPARK = [12, 18, 14, 22, 30, 26, 34, 40, 36, 44];

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3 py-6" style={{ borderBottom: '1px solid var(--line)' }}>
      <h2 className="t-h2">{title}</h2>
      {children}
    </section>
  );
}

function SandboxContent() {
  const [seg, setSeg] = useState('trending');
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <Section title="토큰">
        <div className="flex flex-wrap gap-3">
          {['bg', 'surface', 'surface-2', 'line', 'fg', 'fg-2', 'fg-3', 'accent', 'accent-soft', 'up', 'down', 'warn'].map((t) => (
            <div key={t} className="flex flex-col items-center gap-1">
              <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-m)', background: `var(--${t})`, border: '1px solid var(--line)' }} />
              <span className="t-small">{t}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="타입 롤">
        <p className="t-display">display 오늘의 카드</p>
        <p className="t-h1">h1 EGO-BLOOM</p>
        <p className="t-h2">h2 제작자 랭킹</p>
        <p className="t-h3">h3 카이토</p>
        <p className="t-card-name">card-name 레이니 아스트라</p>
        <p className="t-figure">2,412.7</p>
        <p className="t-body">body 문단 텍스트가 이렇게 흐른다.</p>
        <p className="t-small" style={{ color: 'var(--fg-2)' }}>small 보조 텍스트</p>
        <p className="t-label">LABEL TEXT</p>
      </Section>

      <Section title="버튼 / 칩 / 세그먼트 / 인풋">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="eb-btn eb-btn-primary">기본 버튼</button>
          <button type="button" className="eb-btn eb-btn-secondary">보조 버튼</button>
          <button type="button" className="eb-btn-icon"><span className="t-label">i</span></button>
          <span className="eb-chip">일반 칩</span>
          <span className="eb-chip" data-selected>선택된 칩</span>
          <ThemeToggle />
        </div>
        <Segmented
          options={[
            { value: 'trending', label: '트렌딩' },
            { value: 'best', label: '베스트' },
            { value: 'new', label: '신작' },
          ]}
          value={seg}
          onChange={setSeg}
        />
        <input className="eb-input max-w-xs" placeholder="@핸들로 제작자 찾기" />
        <button type="button" className="eb-btn eb-btn-secondary w-fit" onClick={() => setModalOpen(true)}>
          모달 열기
        </button>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="모달 예시">
          <p className="t-body">Esc 나 배경 클릭으로 닫힌다.</p>
        </Modal>
      </Section>

      <Section title="TierMark (제작자 티어)">
        {['bg', 'surface'].map((ground) => (
          <div
            key={ground}
            className="flex flex-col gap-4 p-4 rounded-[var(--radius-l)]"
            style={{ background: `var(--${ground})`, border: '1px solid var(--line)' }}
          >
            <span className="t-label" style={{ color: 'var(--fg-3)' }}>{`--${ground}`}</span>
            {[24, 40, 64, 120].map((size) => (
              <div key={size} className="flex flex-wrap items-end gap-5">
                <TierMark tier={null} size={size} showPips />
                {CREATOR_TIERS.map((t) => (
                  <TierMark key={t.key} tier={t.key} division={2} size={size} showPips />
                ))}
              </div>
            ))}
          </div>
        ))}

        <div className="flex items-end gap-3">
          <span className="t-small" style={{ color: 'var(--fg-2)' }}>골드 division IV..I</span>
          {[4, 3, 2, 1].map((division) => (
            <TierMark key={division} tier="gold" division={division} size={40} showPips />
          ))}
        </div>
      </Section>

      <Section title="RarityTab (캐릭터 희귀도)">
        <div className="flex flex-wrap gap-2">
          {CHAR_TIERS.map((t) => (
            <RarityTab key={t.key} tier={t.key} />
          ))}
        </div>
      </Section>

      <Section title="CharCard">
        <div className="eb-scroll-x">
          {MOCK_CHARS.map((c) => (
            <CharCard key={c.name} {...c} size="rail" countLabel="대화" />
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          <CharCard {...MOCK_CHARS[0]} size="hero" countLabel="대화" priority />
          <div className="w-40">
            <CharCard {...MOCK_CHARS[1]} size="grid" countLabel="대화" />
          </div>
          <CharCard {...MOCK_CHARS[2]} size="mini" />
        </div>
      </Section>

      <Section title="PlayerCard">
        <div className="flex flex-wrap gap-4 items-start">
          <div className="w-[280px]">
            <PlayerCard
              name="문베일"
              handle="moonveil"
              tier="master"
              division={2}
              eloRaw={17820000}
              rank={1}
              stats={[
                { label: '대화', value: 27200000 },
                { label: '팔로워', value: 12400 },
              ]}
            />
          </div>
          <div className="w-[200px]">
            <PlayerCard name="더스크포지" handle="duskforge" tier="diamond" division={1} eloRaw={4210000} rank={2} compact />
          </div>
        </div>
      </Section>

      <Section title="Num / Delta / Sparkline">
        <div className="flex flex-wrap items-center gap-6">
          <Num value={272000000} />
          <Num value={5412.3} unit="" />
          <Delta value={128} />
          <Delta value={-42} />
          <Delta value={0} />
          <Sparkline values={MOCK_SPARK} />
        </div>
      </Section>

      <Section title="스켈레톤">
        <div className="eb-skel flex gap-3">
          <div className="eb-bone" style={{ width: 152, height: 212 }} />
          <div className="flex flex-col gap-2">
            <div className="eb-bone" style={{ width: 120, height: 16 }} />
            <div className="eb-bone" style={{ width: 80, height: 12 }} />
          </div>
        </div>
      </Section>
    </div>
  );
}

/**
 * 개발 전용 primitive 갤러리다. /dev/design 에서만 접근하고, DEV 빌드에만 포함된다.
 * 데스크톱 폭과 390px 폭(모바일) 두 컬럼을 나란히 보여준다.
 */
export default function DesignSandbox() {
  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <h1 className="t-display mb-6">Design Sandbox</h1>
      <div className="flex flex-col xl:flex-row gap-10 items-start">
        <div className="flex-1 min-w-0 max-w-[1200px] w-full">
          <p className="t-label mb-2" style={{ color: 'var(--fg-3)' }}>DESKTOP</p>
          <SandboxContent />
        </div>
        <div style={{ width: 390 }} className="shrink-0">
          <p className="t-label mb-2" style={{ color: 'var(--fg-3)' }}>390PX</p>
          <div style={{ width: 390, border: '1px solid var(--line)', borderRadius: 'var(--radius-l)', overflow: 'hidden' }}>
            <div className="p-4">
              <SandboxContent />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

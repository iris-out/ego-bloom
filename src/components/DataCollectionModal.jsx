import React, { useEffect } from 'react';
import { X, Database, ShieldCheck, Clock } from 'lucide-react';

export default function DataCollectionModal({ isOpen, onClose }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* 배경 딤 */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
        }}
      />

      {/* 모달 본체 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          background: '#0A0612',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* 상단 컬러 바 */}
        <div style={{ height: '3px', background: 'linear-gradient(to right, #a855f7, #6366f1)' }} />

        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={16} color="#c084fc" />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px', letterSpacing: '0.02em' }}>
              데이터 수집 안내
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.35)', padding: '4px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.7', margin: 0 }}>
            Ego-Bloom은 랭킹 시스템 운영 및 트렌드 분석을 위해 최소한의 공개 데이터를 수집하여 저장하고 있습니다. 수집된 데이터는 서비스 개선 목적으로만 사용됩니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* 수집 항목 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                marginTop: '2px', padding: '6px', borderRadius: '8px',
                background: 'rgba(59,130,246,0.1)', color: '#60a5fa', flexShrink: 0,
              }}>
                <Database size={14} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>수집 항목</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.6' }}>
                  크리에이터 닉네임, 팔로워 수, 대화량 총합, 보이스 재생 시간 - 개인정보를 수집하지 않습니다.
                </div>
              </div>
            </div>

            {/* 수집 목적 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                marginTop: '2px', padding: '6px', borderRadius: '8px',
                background: 'rgba(16,185,129,0.1)', color: '#34d399', flexShrink: 0,
              }}>
                <ShieldCheck size={14} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>수집 목적</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.6' }}>
                  글로벌 랭킹 산정, 티어 분포 분석, 인기 트렌드 분석 및 오픈월드 콘텐츠 시각화
                </div>
              </div>
            </div>

            {/* 보관 및 파기 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{
                marginTop: '2px', padding: '6px', borderRadius: '8px',
                background: 'rgba(245,158,11,0.1)', color: '#fbbf24', flexShrink: 0,
              }}>
                <Clock size={14} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '4px' }}>보관 및 파기</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.6' }}>
                  수집된 랭킹 데이터는 제타에서 공개된 데이터 중 최소한의 데이터만을 사용하면서 트렌드 분석을 위해 일정 기간 보관되며, 서비스 운영 목적이 달성된 후(또는 유저 요청 시) 지체 없이 파기됩니다.
                  본인의 등수가 랭킹에 노출되는 것을 원하지 않으시다면, irisout_@outlook.kr 에 문의해 주세요.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div style={{ padding: '0 20px 20px' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(to right, rgba(168,85,247,0.4), rgba(99,102,241,0.4))',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.03em',
              transition: 'all 0.2s',
              outline: 'none',
            }}
          >
            확인했습니다
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect } from 'react';
import { X, AlertTriangle, ShieldCheck, UserMinus, Info, Github, Mail } from 'lucide-react';

export default function SearchWarningModal({ isOpen, onClose }) {
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
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* 모달 본체 */}
      <div
        className="animate-fade-in-up"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          background: '#0F0A1A',
          border: '1px solid rgba(251, 146, 60, 0.2)',
          borderRadius: '24px',
          overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8), 0 0 40px rgba(251, 146, 60, 0.1)',
        }}
      >
        {/* 상단 컬러 바 (주황색) */}
        <div style={{ height: '4px', background: 'linear-gradient(to right, #fb923c, #f97316)' }} />

        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '24px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              padding: '8px',
              borderRadius: '12px',
              background: 'rgba(251, 146, 60, 0.1)',
              color: '#fb923c'
            }}>
              <AlertTriangle size={20} />
            </div>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: '18px', letterSpacing: '-0.01em' }}>
              검색 전 주의사항 (필독)
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)', padding: '8px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ color: '#fb923c', flexShrink: 0, marginTop: '2px' }}><Info size={18} /></div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', margin: 0 }}>
              검색 시 자동으로 랭킹에 등재되며, 대화량과 팔로워가 내부 계산을 통하여 점수화되어 티어와 함께 올라가게 됩니다.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ color: '#fb923c', flexShrink: 0, marginTop: '2px' }}><ShieldCheck size={18} /></div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', margin: 0 }}>
              제작자의 개인정보나 기타 민감한 정보를 수집하지 않습니다. 또한, 이를 이용하여 사적인 이득이나 영리적인 이득을 취하지 않습니다.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ color: '#fb923c', flexShrink: 0, marginTop: '2px' }}><UserMinus size={18} /></div>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', margin: 0 }}>
              다른 사람이 자신을 검색하는 경우에도 랭킹에 등재되게 설정되어 있습니다. (제작자가 제작자 자신임을 인증할 수단이 없기 때문에 개방해 둔 기능입니다.)
            </p>
          </div>

          <div style={{ 
            marginTop: '8px',
            padding: '20px', 
            borderRadius: '16px', 
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6', marginBottom: '16px' }}>
              만일 자신이 랭킹에 등재되는 것을 원하지 않는다면, 아래 채널로 문의해 주세요. 삭제 및 등록 방지 조치를 취하겠습니다.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <a 
                href="mailto:irisout_@outlook.kr"
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px',
                  color: '#fff', textDecoration: 'none', fontSize: '14px',
                  padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <Mail size={16} /> <span>이메일 문의 (irisout_@outlook.kr)</span>
              </a>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div style={{ padding: '0 24px 24px' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              border: 'none',
              cursor: 'pointer',
              background: '#fb923c',
              color: '#000',
              fontSize: '15px',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              transition: 'all 0.2s',
              outline: 'none',
              boxShadow: '0 4px 12px rgba(251, 146, 60, 0.3)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f97316';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#fb923c';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            모든 내용을 확인했습니다
          </button>
        </div>
      </div>
    </div>
  );
}

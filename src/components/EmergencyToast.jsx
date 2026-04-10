import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';

/**
 * Dynamic Island style emergency toast message.
 * Appears when the server status is yellow (warning) or red (error).
 * Automatically disappears after 10 seconds.
 */
export default function EmergencyToast({ status, message }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ((status === 'warning' || status === 'error') && message) {
      setVisible(true);
      
      const timer = setTimeout(() => {
        setVisible(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [status, message]);

  if (!visible || !message) return null;

  const isError = status === 'error';
  const accentColor = isError ? '#F87171' : '#FBBF24';
  const borderColor = isError ? 'rgba(248, 113, 113, 0.4)' : 'rgba(251, 191, 36, 0.4)';

  return (
    <div className="fixed top-4 left-0 right-0 z-[1000] flex justify-center px-6 pointer-events-none">
      <div 
        className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-[22px] backdrop-blur-2xl border animate-di-expand shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-w-full sm:max-w-[500px]"
        style={{ 
          backgroundColor: 'rgba(10, 8, 20, 0.85)',
          borderColor: borderColor,
        }}
      >
        <div className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full" style={{ backgroundColor: `${accentColor}15` }}>
          {isError ? (
            <AlertCircle size={15} strokeWidth={2.5} style={{ color: accentColor }} />
          ) : (
            <AlertTriangle size={15} strokeWidth={2.5} style={{ color: accentColor }} />
          )}
        </div>
        
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: accentColor }}>
            ZETA AI의 메시지
          </p>
          <p className="text-[13px] font-semibold text-white/95 leading-snug break-keep">
            {message}
          </p>
        </div>

        <button 
          onClick={() => setVisible(false)}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

import React from 'react';
import { X } from 'lucide-react';
import { CHANGELOG, APP_VERSION } from '../data/changelog';

export default function ChangelogModal({ isOpen, onClose }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div
                className="relative w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl max-h-[80vh] flex flex-col animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                        📋 업데이트 내역
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto px-5 py-4 space-y-5">
                    {CHANGELOG.map((entry) => (
                        <div key={entry.version}>
                            <div className="flex items-center gap-2 mb-2.5">
                                <span className="text-sm font-black text-[var(--accent)]">v{entry.version}</span>
                                {entry.label && (
                                    <span className="text-xs font-semibold text-[var(--text-secondary)]">— {entry.label}</span>
                                )}
                                {entry.version === APP_VERSION && (
                                    <span className="ml-auto text-[9px] font-bold bg-[var(--accent)] text-white px-1.5 py-0.5 rounded-full">
                                        최신
                                    </span>
                                )}
                            </div>
                            <div className="text-[10px] text-[var(--text-tertiary)] mb-2">{entry.date}</div>
                            <ul className="space-y-1.5">
                                {entry.changes.map((change, i) => (
                                    <li key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                                        <span className="text-[var(--accent)] mt-0.5 shrink-0 font-bold">·</span>
                                        {change}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

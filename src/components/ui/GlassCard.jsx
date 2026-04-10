import React from 'react';

const VARIANTS = {
  default: 'glass-card',
  sm: 'glass-card-sm',
  pill: 'glass-pill',
};

export default function GlassCard({ variant = 'default', className = '', children, onClick, ...props }) {
  const base = VARIANTS[variant] || VARIANTS.default;
  return (
    <div className={`${base} ${className}`} onClick={onClick} {...props}>
      {children}
    </div>
  );
}

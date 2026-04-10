import React, { useState } from 'react';
import { formatNumber } from '../utils/tierCalculator';

export default function HoverNumber({ value, className = '' }) {
    const [isHovered, setIsHovered] = useState(false);

    if (value === undefined || value === null) return null;

    const shortVer = formatNumber(value);
    const longVer = value.toLocaleString();
    const hasHover = shortVer !== longVer;

    return (
        <span
            className={`relative cursor-help inline-flex items-baseline justify-center transition-all duration-300 ${className}`}
            onMouseEnter={() => hasHover && setIsHovered(true)}
            onMouseLeave={() => hasHover && setIsHovered(false)}
            title={longVer}
        >
            {/* 레이아웃을 고정하기 위한 보이지 않는 자리표시자 */}
            <span className="invisible whitespace-nowrap">
                {longVer}
            </span>

            <span
                className="absolute inset-0 flex items-baseline justify-center whitespace-nowrap"
            >
                {hasHover && !isHovered ? shortVer : longVer}
            </span>
        </span>
    );
}

import React, { useState } from 'react';
import { formatNumber } from '../utils/tierCalculator';

export default function HoverNumber({ value, className = '' }) {
    const [isHovered, setIsHovered] = useState(false);

    if (value === undefined || value === null) return null;

    const shortVer = formatNumber(value);
    const longVer = value.toLocaleString();

    // If short and long are same (e.g. small numbers), no need for effect
    if (shortVer === longVer) {
        return <span className={className}>{longVer}</span>;
    }

    return (
        <span
            className={`cursor-help inline-flex items-baseline transition-all duration-300 ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={isHovered ? '' : longVer}
        >
            <span className={`transition-all duration-300 whitespace-nowrap ${isHovered ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                {shortVer}
            </span>
            <span className={`transition-all duration-300 whitespace-nowrap ${isHovered ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'}`}>
                {longVer}
            </span>
        </span>
    );
}

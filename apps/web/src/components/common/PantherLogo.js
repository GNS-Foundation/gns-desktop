import React from 'react';

// Realistic Panther Logo (Golden Eyes)
const PantherLogo = ({ size = 64, className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 200 200" className={className}>
        <defs>
            <linearGradient id="furGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2d2d2d" />
                <stop offset="50%" stopColor="#1a1a1a" />
                <stop offset="100%" stopColor="#0d0d0d" />
            </linearGradient>
            <linearGradient id="eyeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFD700" />
                <stop offset="50%" stopColor="#FFA500" />
                <stop offset="100%" stopColor="#FF8C00" />
            </linearGradient>
            <radialGradient id="eyeShine" cx="30%" cy="30%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
        </defs>
        <path d="M100 25 C 45 25, 20 70, 25 110 C 28 140, 45 170, 100 180 C 155 170, 172 140, 175 110 C 180 70, 155 25, 100 25 Z" fill="url(#furGradient)" />
        <path d="M35 55 C 25 25, 45 10, 60 35 C 55 45, 45 50, 35 55 Z" fill="#1a1a1a" />
        <path d="M40 50 C 35 35, 48 25, 55 40 C 52 45, 45 48, 40 50 Z" fill="#2a2a2a" />
        <path d="M165 55 C 175 25, 155 10, 140 35 C 145 45, 155 50, 165 55 Z" fill="#1a1a1a" />
        <path d="M160 50 C 165 35, 152 25, 145 40 C 148 45, 155 48, 160 50 Z" fill="#2a2a2a" />
        <path d="M45 75 C 55 68, 70 70, 80 78" stroke="#0d0d0d" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M155 75 C 145 68, 130 70, 120 78" stroke="#0d0d0d" strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="65" cy="95" rx="22" ry="18" fill="#0d0d0d" />
        <ellipse cx="135" cy="95" rx="22" ry="18" fill="#0d0d0d" />
        <ellipse cx="65" cy="95" rx="16" ry="14" fill="url(#eyeGradient)" />
        <ellipse cx="65" cy="95" rx="7" ry="12" fill="#0d0d0d" />
        <ellipse cx="62" cy="92" rx="4" ry="3" fill="url(#eyeShine)" />
        <ellipse cx="135" cy="95" rx="16" ry="14" fill="url(#eyeGradient)" />
        <ellipse cx="135" cy="95" rx="7" ry="12" fill="#0d0d0d" />
        <ellipse cx="132" cy="92" rx="4" ry="3" fill="url(#eyeShine)" />
        <path d="M100 85 L100 115" stroke="#151515" strokeWidth="3" fill="none" />
        <path d="M85 125 C 85 115, 90 110, 100 110 C 110 110, 115 115, 115 125 C 115 132, 108 138, 100 138 C 92 138, 85 132, 85 125 Z" fill="#1a1a1a" />
        <ellipse cx="100" cy="125" rx="10" ry="7" fill="#2d2d2d" />
        <ellipse cx="93" cy="127" rx="4" ry="3" fill="#0d0d0d" />
        <ellipse cx="107" cy="127" rx="4" ry="3" fill="#0d0d0d" />
        <path d="M70 135 C 75 145, 85 155, 100 158 C 115 155, 125 145, 130 135" fill="none" stroke="#252525" strokeWidth="2" />
        <path d="M100 138 L100 148" stroke="#151515" strokeWidth="2" />
        <path d="M100 148 C 90 155, 85 152, 82 148" stroke="#151515" strokeWidth="2" fill="none" />
        <path d="M100 148 C 110 155, 115 152, 118 148" stroke="#151515" strokeWidth="2" fill="none" />
        <circle cx="60" cy="135" r="2" fill="#252525" />
        <circle cx="55" cy="142" r="2" fill="#252525" />
        <circle cx="52" cy="128" r="2" fill="#252525" />
        <circle cx="140" cy="135" r="2" fill="#252525" />
        <circle cx="145" cy="142" r="2" fill="#252525" />
        <circle cx="148" cy="128" r="2" fill="#252525" />
    </svg>
);

export default PantherLogo;

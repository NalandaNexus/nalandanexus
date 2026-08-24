import React from 'react';
import { motion } from 'framer-motion';

export default function DiyaStreak({ streakDays = 6, longest = 9, className = '' }) {
  // Flame intensity calculation based on streak days
  const isBroken = streakDays <= 0;
  const isTier1 = streakDays === 1;
  const isTier2 = streakDays >= 2 && streakDays <= 3;
  const isTier3 = streakDays >= 4 && streakDays <= 5;
  const isTier4 = streakDays >= 6;

  // Flame dimensions & scale
  let flameScale = 1;
  let flameOpacity = 0.95;
  let glowOpacity = 0.55;
  let flameHeight = 32;

  if (isBroken) {
    flameScale = 0.6;
    flameOpacity = 0.45;
    glowOpacity = 0.15;
    flameHeight = 18;
  } else if (isTier1) {
    flameScale = 0.75;
    flameOpacity = 0.75;
    glowOpacity = 0.3;
    flameHeight = 22;
  } else if (isTier2) {
    flameScale = 0.88;
    flameOpacity = 0.85;
    glowOpacity = 0.45;
    flameHeight = 26;
  } else if (isTier3) {
    flameScale = 0.95;
    flameOpacity = 0.92;
    glowOpacity = 0.55;
    flameHeight = 30;
  } else if (isTier4) {
    flameScale = 1.05;
    flameOpacity = 1;
    glowOpacity = 0.7;
    flameHeight = 35;
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#FAF8F3] border border-[#DFDACB] shadow-sm transition-all select-none ${className}`}
      title={`${streakDays} Day Learning Streak (Longest: ${longest} days)`}
      aria-label={`${streakDays} day learning streak`}
    >
      {/* SVG Diya Lamp with Layered Flame */}
      <div className="relative w-7 h-7 flex items-center justify-center">
        {/* Soft Ambient Warm Aura */}
        <div
          className="absolute inset-0 rounded-full bg-[#C99A2E]/20 animate-flame-glow pointer-events-none"
          style={{ opacity: glowOpacity }}
        />

        <svg
          viewBox="0 0 44 44"
          className="w-full h-full overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Terracotta Clay Lamp Gradient */}
            <linearGradient id="clayGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C4684D" />
              <stop offset="60%" stopColor="#AB5236" />
              <stop offset="100%" stopColor="#7E331E" />
            </linearGradient>

            {/* Turmeric Gold Flame Outer Gradient */}
            <linearGradient id="flameOuterGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#AB5236" />
              <stop offset="35%" stopColor="#C99A2E" />
              <stop offset="80%" stopColor="#F5B041" />
              <stop offset="100%" stopColor="#FEF9E7" />
            </linearGradient>

            {/* Inner Flame Hot Core Gradient */}
            <linearGradient id="flameInnerGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#F5B041" />
              <stop offset="60%" stopColor="#FFF275" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>

            {/* Brass Lip Highlight */}
            <linearGradient id="rimHighlight" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#DFDACB" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#DFDACB" stopOpacity="0.4" />
            </linearGradient>
          </defs>

          {/* 1. Diya Base / Earthen Bowl */}
          {/* Base Stand */}
          <ellipse cx="22" cy="38" rx="8" ry="2.5" fill="#7E331E" opacity="0.6" />

          {/* Clay Body */}
          <path
            d="M 8 28 C 8 36, 14 39, 22 39 C 30 39, 36 36, 36 28 C 36 25, 34 24, 22 24 C 10 24, 8 25, 8 28 Z"
            fill="url(#clayGradient)"
          />

          {/* Clay Bowl Lip */}
          <ellipse
            cx="22"
            cy="26"
            rx="14"
            ry="4"
            fill="#AB5236"
            stroke="url(#rimHighlight)"
            strokeWidth="0.8"
          />

          {/* Oil Reservoir Depth */}
          <ellipse cx="22" cy="26" rx="10.5" ry="2.5" fill="#5A2212" opacity="0.85" />

          {/* Cotton Wick Point */}
          <path
            d="M 21 26 Q 22 21 22 18"
            stroke="#2B2B28"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* 2. Dynamic Flame (Animated with CSS keyframes) */}
          <g
            className="animate-flame"
            style={{
              transformOrigin: '22px 20px',
              opacity: flameOpacity,
            }}
          >
            {/* Outer Flame Teardrop */}
            <path
              d={`M 22 4 C 17 12, 14 17, 16 22 C 18 25, 26 25, 28 22 C 30 17, 27 12, 22 4 Z`}
              fill="url(#flameOuterGrad)"
              transform={`scale(${flameScale}) translate(${(1 - flameScale) * 22}, ${(1 - flameScale) * 16})`}
            />

            {/* Inner Hot Core */}
            <path
              d="M 22 10 C 19 15, 17 18, 18 21 C 19 23, 25 23, 26 21 C 27 18, 25 15, 22 10 Z"
              fill="url(#flameInnerGrad)"
              opacity="0.9"
              transform={`scale(${flameScale * 0.85}) translate(${(1 - flameScale * 0.85) * 22}, ${(1 - flameScale * 0.85) * 18})`}
            />
          </g>
        </svg>
      </div>

      {/* Streak Text */}
      <div className="flex items-baseline gap-1">
        <span className="font-data font-bold text-sm text-[#22355E] tracking-tight">
          {streakDays}
        </span>
        <span className="font-body text-xs font-semibold text-[#2B2B28]/80">
          day streak
        </span>
      </div>
    </div>
  );
}

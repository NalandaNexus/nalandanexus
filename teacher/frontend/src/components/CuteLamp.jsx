import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function CuteLamp({
  currentTheme,
  isOn,
  onToggleLamp,
  isPulling,
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative flex flex-col items-center justify-center select-none w-full max-w-[380px]">
      {/* Ambient Radial Glow */}
      <div
        className="absolute w-[340px] h-[340px] rounded-full pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(circle, rgba(${currentTheme.themeGlowRGB}, ${
            isOn ? '0.35' : '0.03'
          }) 0%, transparent 70%)`,
          filter: isOn ? 'blur(30px)' : 'none',
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
        }}
      />

      {/* Status Pill Badge above lamp */}
      <div className="mb-3 z-10">
        <button
          type="button"
          onClick={onToggleLamp}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md transition-all duration-300 border shadow-lg hover:scale-105 cursor-pointer"
          style={{
            backgroundColor: isOn
              ? `rgba(${currentTheme.themeGlowRGB}, 0.15)`
              : 'rgba(30, 41, 59, 0.6)',
            borderColor: isOn ? currentTheme.themeColor : '#334155',
            color: isOn ? '#ffffff' : '#94a3b8',
            boxShadow: isOn
              ? `0 0 15px rgba(${currentTheme.themeGlowRGB}, 0.3)`
              : 'none',
          }}
        >
          <span
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              isOn ? 'animate-pulse' : 'bg-slate-600'
            }`}
            style={{
              backgroundColor: isOn ? currentTheme.themeColor : undefined,
            }}
          />
          <span>{isOn ? 'Faculty Lamp ON • Form Revealed' : 'Faculty Lamp OFF • Pull Cord'}</span>
          <Sparkles className={`w-3.5 h-3.5 ${isOn ? 'opacity-100 text-cyan-300' : 'opacity-40'}`} />
        </button>
      </div>

      {/* SVG Lamp */}
      <svg
        className="w-full max-w-[340px] h-auto overflow-visible relative z-10 drop-shadow-2xl transition-transform duration-300"
        viewBox="0 0 300 450"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="teacherLightConeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id="teacherMouthClip">
            <path d="M 125 155 Q 150 190 175 155 Z" />
          </clipPath>
        </defs>

        {/* Light Cone Projector */}
        <polygon
          points="90,180 210,180 320,450 -20,450"
          fill="url(#teacherLightConeGrad)"
          className="transition-opacity duration-700 ease-in-out pointer-events-none"
          style={{ opacity: currentTheme.lightOpacity }}
        />

        {/* Lamp Base Platform */}
        <ellipse cx="150" cy="400" rx="60" ry="15" fill="#111827" />
        <ellipse
          cx="150"
          cy="395"
          rx="60"
          ry="15"
          fill="#1f2937"
          stroke={isOn ? currentTheme.themeColor : '#374151'}
          strokeWidth="1.5"
          className="transition-all duration-500"
        />

        {/* Lamp Pole / Stand */}
        <rect x="140" y="180" width="20" height="215" fill="#1e293b" rx="2" />
        <rect x="143" y="180" width="6" height="215" fill="#334155" />

        {/* Inner Shade / Bulb Area */}
        <ellipse
          cx="150"
          cy="175"
          rx="90"
          ry="20"
          className="transition-all duration-500"
          style={{
            fill: currentTheme.bulbColor,
            filter: isOn ? `drop-shadow(0 0 12px rgba(${currentTheme.themeGlowRGB}, 0.8))` : 'none',
          }}
        />

        {/* Pull String & Handle Group (Interactive) */}
        <g
          className="cursor-pointer group"
          onClick={onToggleLamp}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            transform: isPulling ? 'translateY(16px)' : 'translateY(0)',
            transformOrigin: '105px 180px',
            transition: 'transform 0.16s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          }}
        >
          {/* Cord */}
          <line
            x1="105"
            y1="180"
            x2="105"
            y2="280"
            stroke={isHovered ? '#94a3b8' : '#475569'}
            strokeWidth="3"
            strokeDasharray="4 2"
            className="transition-colors duration-200"
          />
          {/* Pull Bead / Handle */}
          <line
            x1="105"
            y1="280"
            x2="105"
            y2="312"
            stroke={isHovered || isPulling ? '#ffffff' : '#94a3b8'}
            strokeWidth="7"
            strokeLinecap="round"
            className="transition-colors duration-200"
            style={{
              filter: isHovered
                ? `drop-shadow(0 0 6px ${currentTheme.themeColor})`
                : 'none',
            }}
          />
          {/* Mini Ring at bottom */}
          <circle
            cx="105"
            cy="314"
            r="4"
            fill={isHovered ? currentTheme.themeColor : '#cbd5e1'}
            className="transition-colors duration-200"
          />
        </g>

        {/* Lamp Shade Main Shell */}
        <path
          d="M 95 60 Q 150 45 205 60 L 240 175 Q 150 195 60 175 Z"
          className="transition-all duration-500 ease-in-out cursor-pointer hover:brightness-105"
          onClick={onToggleLamp}
          style={{
            fill: currentTheme.shadeColor,
            filter: isOn
              ? `drop-shadow(0 4px 20px rgba(${currentTheme.themeGlowRGB}, 0.4))`
              : 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))',
          }}
        />

        {/* Cute Face - Sleep State */}
        <g
          className="transition-opacity duration-300 ease-in-out pointer-events-none"
          style={{ opacity: currentTheme.faceSleepOpacity }}
        >
          {/* Closed Sleeping Eyes */}
          <path
            d="M 115 130 Q 125 140 135 130"
            stroke="#0f172a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 165 130 Q 175 140 185 130"
            stroke="#0f172a"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          {/* Subtle Cute Zzz mark */}
          <text
            x="200"
            y="95"
            fill="#94a3b8"
            fontSize="14"
            fontWeight="bold"
            className="animate-pulse"
            style={{ opacity: 0.6 }}
          >
            z
          </text>
          <text
            x="215"
            y="80"
            fill="#94a3b8"
            fontSize="18"
            fontWeight="bold"
            className="animate-pulse"
            style={{ opacity: 0.8 }}
          >
            Z
          </text>
        </g>

        {/* Cute Face - Awake State */}
        <g
          className="transition-opacity duration-300 ease-in-out pointer-events-none"
          style={{ opacity: currentTheme.faceAwakeOpacity }}
        >
          {/* Happy Open Eyes */}
          <path
            d="M 115 130 Q 125 115 135 130"
            stroke="#0f172a"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 165 130 Q 175 115 185 130"
            stroke="#0f172a"
            strokeWidth="4.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* Rosy Blushing Cheeks */}
          <circle cx="106" cy="140" r="6" fill="#f43f5e" opacity="0.45" />
          <circle cx="194" cy="140" r="6" fill="#f43f5e" opacity="0.45" />

          {/* Happy Smiling Open Mouth */}
          <g>
            <path d="M 125 153 Q 150 188 175 153 Z" fill="#0f172a" />
            <path
              d="M 138 163 Q 150 188 162 163 Z"
              fill="#fb7185"
              clipPath="url(#teacherMouthClip)"
            />
          </g>
        </g>
      </svg>

      {/* Interactive Helper Hint */}
      <div className="mt-3 text-center z-10">
        <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5 font-medium">
          <span>{isOn ? '💡 Pull cord to turn OFF & hide form' : '💡 Pull cord to turn ON & reveal form'}</span>
        </p>
      </div>
    </div>
  );
}

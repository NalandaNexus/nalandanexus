import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CharacterStage({
  focusState = 'idle', // 'idle' | 'email' | 'name' | 'password-hidden' | 'password-peek' | 'celebrating' | 'confused'
  mousePosition = { x: 0, y: 0 },
  caretRatio = 0,
  onCharacterClick,
  speechText = 'Welcome to Nalanda Nexus! 🎓',
}) {
  const svgRef = useRef(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const [bounceChar, setBounceChar] = useState(null);

  // Natural Blinking Cycle
  useEffect(() => {
    let blinkTimer;
    const triggerBlink = () => {
      if (focusState !== 'password-hidden') {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 140);
      }
      const nextDelay = 2500 + Math.random() * 3500;
      blinkTimer = setTimeout(triggerBlink, nextDelay);
    };

    blinkTimer = setTimeout(triggerBlink, 3000);
    return () => clearTimeout(blinkTimer);
  }, [focusState]);

  // Compute Eye Pupil Offsets via Math.atan2
  const eyeOffsets = useMemo(() => {
    if (focusState === 'password-hidden') {
      return { x: 0, y: 0, faceX: 0, faceY: 0 };
    }

    if (!svgRef.current) {
      return { x: 0, y: 0, faceX: 0, faceY: 0 };
    }

    const rect = svgRef.current.getBoundingClientRect();
    const stageCenterX = rect.left + rect.width * 0.48;
    const stageCenterY = rect.top + rect.height * 0.5;

    let targetX = mousePosition.x;
    let targetY = mousePosition.y;

    // If focused on an input, pull target toward the form field on the right
    if (focusState === 'email' || focusState === 'name') {
      targetX = rect.right + 120 + caretRatio * 180;
      targetY = rect.top + (focusState === 'name' ? 180 : 250);
    } else if (focusState === 'password-peek') {
      targetX = rect.right + 180;
      targetY = rect.top + 320;
    }

    const deltaX = targetX - stageCenterX;
    const deltaY = targetY - stageCenterY;
    const distance = Math.hypot(deltaX, deltaY);
    const angle = Math.atan2(deltaY, deltaX);

    // Limit pupil travel between 3.5px and 5.5px
    const maxRadius = focusState === 'password-peek' ? 6 : 4.8;
    const clampedDist = Math.min(maxRadius, distance * 0.015);

    const pupilX = Math.cos(angle) * clampedDist;
    const pupilY = Math.sin(angle) * clampedDist;

    // Face tilt parallax
    const faceX = Math.cos(angle) * Math.min(4, distance * 0.008);
    const faceY = Math.sin(angle) * Math.min(3, distance * 0.006);

    return {
      x: Number(pupilX.toFixed(2)),
      y: Number(pupilY.toFixed(2)),
      faceX: Number(faceX.toFixed(2)),
      faceY: Number(faceY.toFixed(2)),
    };
  }, [mousePosition, focusState, caretRatio]);

  const handleCharClick = (name) => {
    setBounceChar(name);
    setTimeout(() => setBounceChar(null), 500);
    if (onCharacterClick) onCharacterClick(name);
  };

  const isPrivacy = focusState === 'password-hidden';
  const isPeek = focusState === 'password-peek';
  const isCelebrate = focusState === 'celebrating';
  const isConfused = focusState === 'confused';

  // Status Indicator Text
  const statusLabel = useMemo(() => {
    switch (focusState) {
      case 'email': return 'Reading email...';
      case 'name': return 'Reading your name...';
      case 'password-hidden': return 'Privacy mode active 🔒';
      case 'password-peek': return 'Peeking at password 👀';
      case 'celebrating': return 'Welcome to Nalanda Nexus! 🎉';
      case 'confused': return 'Checking details 🤔';
      default: return 'Watching cursor';
    }
  }, [focusState]);

  return (
    <div className="relative w-full h-full min-h-[380px] md:min-h-[520px] bg-[#E9EDF4] dark:bg-[#172033] flex flex-col items-center justify-end p-6 md:p-8 overflow-hidden select-none transition-colors duration-300">
      {/* Soft Radial Ambient Lighting on Stage */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(255,255,255,0.7)_0%,transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_60%,rgba(30,41,59,0.5)_0%,transparent_70%)] pointer-events-none" />

      {/* Dynamic Speech Bubble */}
      <AnimatePresence>
        {speechText && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="absolute top-6 md:top-8 z-20 px-4 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-heading font-semibold text-xs sm:text-sm rounded-full shadow-lg shadow-slate-900/10 border border-slate-200/80 dark:border-slate-700 pointer-events-none whitespace-nowrap"
          >
            {speechText}
            {/* Bubble Tail */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 rotate-45 border-r border-b border-slate-200/80 dark:border-slate-700" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* SVG 2.5D Characters Canvas */}
      <motion.svg
        ref={svgRef}
        viewBox="0 0 440 500"
        className="w-full max-w-[340px] md:max-w-[390px] h-auto z-10 filter drop-shadow-[0_15px_25px_rgba(15,23,42,0.08)] cursor-pointer"
        animate={
          isConfused
            ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
            : { x: 0 }
        }
        transition={{ duration: 0.5 }}
      >
        <defs>
          {/* Rich Soft 3D Gradients */}
          <linearGradient id="reactPurpleGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="40%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#5B21B6" />
          </linearGradient>

          <linearGradient id="reactPinkGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F43F5E" />
            <stop offset="45%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#BE123C" />
          </linearGradient>

          <linearGradient id="reactOrangeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FB923C" />
            <stop offset="60%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>

          <linearGradient id="reactYellowGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>

          <linearGradient id="reactEyeShine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.1" />
          </linearGradient>

          <filter id="reactBlobShadow" x="-15%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#0f172a" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Stage Floor Shadow */}
        <ellipse cx="220" cy="485" rx="190" ry="18" fill="#0f172a" fillOpacity="0.08" />

        {/* ======================================================== */}
        {/* 1. PURPLE CHARACTER (Back-Left Tall Rectangle)           */}
        {/* ======================================================== */}
        <motion.g
          id="charPurple"
          onClick={() => handleCharClick('purple')}
          animate={
            isCelebrate
              ? { y: [0, -30, 4, -12, 0], scaleY: [1, 1.12, 0.94, 1.04, 1] }
              : bounceChar === 'purple'
              ? { scale: [1, 1.12, 0.9, 1] }
              : {}
          }
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="animate-idle-purple origin-bottom cursor-pointer"
        >
          {/* Body */}
          <rect
            x="110"
            y="145"
            width="115"
            height="340"
            rx="34"
            fill="url(#reactPurpleGrad)"
            filter="url(#reactBlobShadow)"
          />
          {/* Inner Highlight */}
          <rect
            x="114"
            y="149"
            width="107"
            height="332"
            rx="30"
            stroke="url(#reactEyeShine)"
            strokeWidth="2"
            fill="none"
            opacity="0.6"
          />

          {/* Parallax Face Group */}
          <g transform={`translate(${eyeOffsets.faceX}, ${eyeOffsets.faceY})`}>
            {/* Left Eye */}
            <g transform="translate(142, 172)">
              <circle cx="0" cy="0" r="10" fill="#FFFFFF" />
              {!isPrivacy && (
                <circle
                  cx={eyeOffsets.x}
                  cy={eyeOffsets.y}
                  r={isPeek ? 5.5 : 4.5}
                  fill="#18181B"
                  transform={isBlinking ? 'scale(1, 0.1)' : 'scale(1, 1)'}
                  className="transition-transform duration-75"
                />
              )}
              {!isPrivacy && !isBlinking && (
                <circle
                  cx={eyeOffsets.x - 1.5}
                  cy={eyeOffsets.y - 1.5}
                  r="1.5"
                  fill="#FFFFFF"
                />
              )}
              {isPrivacy && (
                <path d="M -7,0 Q 0,6 7,0" stroke="#18181B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              )}
            </g>

            {/* Right Eye */}
            <g transform="translate(182, 172)">
              <circle cx="0" cy="0" r="10" fill="#FFFFFF" />
              {!isPrivacy && (
                <circle
                  cx={eyeOffsets.x}
                  cy={eyeOffsets.y}
                  r={isPeek ? 5.5 : 4.5}
                  fill="#18181B"
                  transform={isBlinking ? 'scale(1, 0.1)' : 'scale(1, 1)'}
                  className="transition-transform duration-75"
                />
              )}
              {!isPrivacy && !isBlinking && (
                <circle
                  cx={eyeOffsets.x - 1.5}
                  cy={eyeOffsets.y - 1.5}
                  r="1.5"
                  fill="#FFFFFF"
                />
              )}
              {isPrivacy && (
                <path d="M -7,0 Q 0,6 7,0" stroke="#18181B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              )}
            </g>

            {/* Mouth */}
            <g transform="translate(162, 195)">
              {isCelebrate ? (
                <path d="M -7,-2 Q 0,7 7,-2" stroke="#18181B" strokeWidth="3" fill="none" strokeLinecap="round" />
              ) : focusState === 'email' || focusState === 'name' ? (
                <ellipse cx="0" cy="0" rx="4.5" ry="6.5" fill="#18181B" />
              ) : (
                <line x1="0" y1="-8" x2="0" y2="8" stroke="#18181B" strokeWidth="3" strokeLinecap="round" />
              )}
            </g>
          </g>

          {/* Privacy Covering Hands / Peek Hands */}
          <AnimatePresence>
            {(isPrivacy || isPeek) && (
              <motion.g
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: isPeek ? 12 : 0, scale: isPeek ? 0.9 : 1 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <ellipse cx="142" cy="172" rx="14" ry="11" fill="#7C3AED" stroke="#5B21B6" strokeWidth="2" />
                <ellipse cx="182" cy="172" rx="14" ry="11" fill="#7C3AED" stroke="#5B21B6" strokeWidth="2" />
              </motion.g>
            )}
          </AnimatePresence>
        </motion.g>

        {/* ======================================================== */}
        {/* 2. PINK / MAGENTA CHARACTER (Middle Tall Pill)           */}
        {/* ======================================================== */}
        <motion.g
          id="charPink"
          onClick={() => handleCharClick('pink')}
          animate={
            isCelebrate
              ? { y: [0, -32, 4, -10, 0], scale: [1, 1.08, 0.95, 1.02, 1] }
              : bounceChar === 'pink'
              ? { scale: [1, 1.15, 0.88, 1] }
              : {}
          }
          transition={{ duration: 0.85, delay: 0.08, ease: 'easeOut' }}
          className="animate-idle-pink origin-bottom cursor-pointer"
        >
          <rect
            x="205"
            y="215"
            width="76"
            height="270"
            rx="38"
            fill="url(#reactPinkGrad)"
            filter="url(#reactBlobShadow)"
          />
          <rect
            x="208"
            y="218"
            width="70"
            height="264"
            rx="35"
            stroke="url(#reactEyeShine)"
            strokeWidth="1.8"
            fill="none"
            opacity="0.6"
          />

          {/* Parallax Face Group */}
          <g transform={`translate(${eyeOffsets.faceX * 0.9}, ${eyeOffsets.faceY * 0.9})`}>
            {/* Left Eye */}
            <g transform="translate(230, 238)">
              <circle cx="0" cy="0" r="8.5" fill="#FFFFFF" />
              {!isPrivacy && (
                <circle
                  cx={eyeOffsets.x * 0.9}
                  cy={eyeOffsets.y * 0.9}
                  r={isPeek ? 4.8 : 4}
                  fill="#18181B"
                  transform={isBlinking ? 'scale(1, 0.1)' : 'scale(1, 1)'}
                  className="transition-transform duration-75"
                />
              )}
              {!isPrivacy && !isBlinking && (
                <circle
                  cx={eyeOffsets.x * 0.9 - 1.2}
                  cy={eyeOffsets.y * 0.9 - 1.2}
                  r="1.3"
                  fill="#FFFFFF"
                />
              )}
              {isPrivacy && (
                <path d="M -5,0 Q 0,4 5,0" stroke="#18181B" strokeWidth="2" fill="none" strokeLinecap="round" />
              )}
            </g>

            {/* Right Eye */}
            <g transform="translate(258, 238)">
              <circle cx="0" cy="0" r="8.5" fill="#FFFFFF" />
              {!isPrivacy && (
                <circle
                  cx={eyeOffsets.x * 0.9}
                  cy={eyeOffsets.y * 0.9}
                  r={isPeek ? 4.8 : 4}
                  fill="#18181B"
                  transform={isBlinking ? 'scale(1, 0.1)' : 'scale(1, 1)'}
                  className="transition-transform duration-75"
                />
              )}
              {!isPrivacy && !isBlinking && (
                <circle
                  cx={eyeOffsets.x * 0.9 - 1.2}
                  cy={eyeOffsets.y * 0.9 - 1.2}
                  r="1.3"
                  fill="#FFFFFF"
                />
              )}
              {isPrivacy && (
                <path d="M -5,0 Q 0,4 5,0" stroke="#18181B" strokeWidth="2" fill="none" strokeLinecap="round" />
              )}
            </g>

            {/* Pink Blush Spots */}
            <ellipse
              cx="218"
              cy="254"
              rx={isPrivacy ? 8 : 6}
              ry={isPrivacy ? 5 : 3.5}
              fill="#FDA4AF"
              opacity={isPrivacy ? 0.95 : 0.6}
              className="transition-all duration-300"
            />
            <ellipse
              cx="268"
              cy="254"
              rx={isPrivacy ? 8 : 6}
              ry={isPrivacy ? 5 : 3.5}
              fill="#FDA4AF"
              opacity={isPrivacy ? 0.95 : 0.6}
              className="transition-all duration-300"
            />
          </g>

          {/* Pink Privacy Hands / Shield */}
          <AnimatePresence>
            {(isPrivacy || isPeek) && (
              <motion.g
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: isPeek ? 10 : 0, scale: isPeek ? 0.9 : 1 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <ellipse cx="230" cy="238" rx="12" ry="9" fill="#E11D48" stroke="#BE123C" strokeWidth="2" />
                <ellipse cx="258" cy="238" rx="12" ry="9" fill="#E11D48" stroke="#BE123C" strokeWidth="2" />
              </motion.g>
            )}
          </AnimatePresence>
        </motion.g>

        {/* ======================================================== */}
        {/* 3. ORANGE CHARACTER (Chubby Front-Left Dome)             */}
        {/* ======================================================== */}
        <motion.g
          id="charOrange"
          onClick={() => handleCharClick('orange')}
          animate={
            isCelebrate
              ? { scaleX: [1, 1.1, 0.9, 1.05, 1], scaleY: [1, 0.9, 1.15, 0.95, 1] }
              : isPrivacy
              ? { scaleY: 0.9, scaleX: 1.05 }
              : bounceChar === 'orange'
              ? { scaleX: [1, 1.25, 0.85, 1], scaleY: [1, 0.8, 1.15, 1] }
              : { scaleX: 1, scaleY: 1 }
          }
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          className="animate-idle-orange origin-bottom cursor-pointer"
        >
          <path
            d="M 45,485 C 45,350 100,310 180,310 C 255,310 285,360 285,485 Z"
            fill="url(#reactOrangeGrad)"
            filter="url(#reactBlobShadow)"
          />
          <path
            d="M 50,483 C 50,355 103,315 180,315 C 251,315 280,364 280,483"
            stroke="url(#reactEyeShine)"
            strokeWidth="2"
            fill="none"
            opacity="0.6"
          />

          {/* Parallax Face Group */}
          <g transform={`translate(${eyeOffsets.faceX * 0.75}, ${eyeOffsets.faceY * 0.75})`}>
            {/* Left Eye Dot */}
            <g transform="translate(180, 360)">
              {!isPrivacy ? (
                <>
                  <circle
                    cx={eyeOffsets.x * 0.7}
                    cy={eyeOffsets.y * 0.7}
                    r="4.5"
                    fill="#18181B"
                    transform={isBlinking ? 'scale(1, 0.1)' : 'scale(1, 1)'}
                    className="transition-transform duration-75"
                  />
                  {!isBlinking && (
                    <circle cx={eyeOffsets.x * 0.7 - 1} cy={eyeOffsets.y * 0.7 - 1} r="1.2" fill="#FFFFFF" />
                  )}
                </>
              ) : (
                <path d="M -4,0 Q 0,4 4,0" stroke="#18181B" strokeWidth="2" fill="none" strokeLinecap="round" />
              )}
            </g>

            {/* Nose Dot */}
            <circle cx="196" cy="368" r="3" fill="#18181B" opacity="0.9" />

            {/* Right Eye Dot */}
            <g transform="translate(208, 350)">
              {!isPrivacy ? (
                <>
                  <circle
                    cx={eyeOffsets.x * 0.7}
                    cy={eyeOffsets.y * 0.7}
                    r="4.5"
                    fill="#18181B"
                    transform={isBlinking ? 'scale(1, 0.1)' : 'scale(1, 1)'}
                    className="transition-transform duration-75"
                  />
                  {!isBlinking && (
                    <circle cx={eyeOffsets.x * 0.7 - 1} cy={eyeOffsets.y * 0.7 - 1} r="1.2" fill="#FFFFFF" />
                  )}
                </>
              ) : (
                <path d="M -4,0 Q 0,4 4,0" stroke="#18181B" strokeWidth="2" fill="none" strokeLinecap="round" />
              )}
            </g>

            {/* Cheeks */}
            <ellipse cx="166" cy="374" rx="7" ry="4" fill="#FB7185" opacity="0.5" />
          </g>

          {/* Orange Privacy Cover Arcs */}
          {isPrivacy && (
            <g>
              <path d="M 174,354 Q 180,344 186,354" stroke="#18181B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M 202,344 Q 208,334 214,344" stroke="#18181B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
          )}
        </motion.g>

        {/* ======================================================== */}
        {/* 4. YELLOW CHARACTER (Right Rounded Capsule)              */}
        {/* ======================================================== */}
        <motion.g
          id="charYellow"
          onClick={() => handleCharClick('yellow')}
          animate={
            isCelebrate
              ? { y: [0, -28, 3, -8, 0], rotate: [0, 4, -4, 0] }
              : bounceChar === 'yellow'
              ? { scale: [1, 1.15, 0.9, 1], rotate: [0, 6, -6, 0] }
              : {}
          }
          transition={{ duration: 0.75, delay: 0.12, ease: 'easeOut' }}
          className="animate-idle-yellow origin-bottom cursor-pointer"
        >
          <rect
            x="250"
            y="275"
            width="90"
            height="210"
            rx="45"
            fill="url(#reactYellowGrad)"
            filter="url(#reactBlobShadow)"
          />
          <rect
            x="253"
            y="278"
            width="84"
            height="204"
            rx="42"
            stroke="url(#reactEyeShine)"
            strokeWidth="2"
            fill="none"
            opacity="0.6"
          />

          {/* Parallax Face Group */}
          <g transform={`translate(${eyeOffsets.faceX * 0.7}, ${eyeOffsets.faceY * 0.7})`}>
            {/* Left Eye Dot */}
            <g transform="translate(300, 305)">
              {!isPrivacy ? (
                <>
                  <circle
                    cx={eyeOffsets.x * 0.65}
                    cy={eyeOffsets.y * 0.65}
                    r="3.5"
                    fill="#18181B"
                    transform={isBlinking ? 'scale(1, 0.1)' : 'scale(1, 1)'}
                    className="transition-transform duration-75"
                  />
                  {!isBlinking && (
                    <circle cx={eyeOffsets.x * 0.65 - 0.8} cy={eyeOffsets.y * 0.65 - 0.8} r="1" fill="#FFFFFF" />
                  )}
                </>
              ) : (
                <path d="M -3,0 Q 0,3 3,0" stroke="#18181B" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              )}
            </g>

            {/* Beak / Mouth Line */}
            <g transform="translate(320, 320)">
              {isCelebrate || isPrivacy ? (
                <path d="M -12,-2 Q 0,8 12,-2" stroke="#18181B" strokeWidth="3" fill="none" strokeLinecap="round" />
              ) : (
                <line x1="-18" y1="0" x2="16" y2="0" stroke="#18181B" strokeWidth="4" strokeLinecap="round" />
              )}
            </g>

            {/* Cheeks */}
            <ellipse cx="288" cy="322" rx="5" ry="3" fill="#F43F5E" opacity="0.4" />
          </g>
        </motion.g>
      </motion.svg>

      {/* Stage Status Footer */}
      <div className="flex items-center gap-2 mt-3 z-10">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tracking-wide">
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

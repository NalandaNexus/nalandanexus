import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { playTone } from '../../utils/sound';

export default function NexusMascot() {
  const [speech, setSpeech] = useState("Hi! I'm Nexus, your AI study buddy 👋");

  const prompts = [
    'What do you want to learn today? 🚀',
    'Ask me for a coding exercise! 💻',
    'Need help choosing between Python or ML? 🤖',
    'Check out the latest community projects! ✨',
    'I can explain complex concepts simply! 📚',
  ];

  const handleMascotClick = () => {
    playTone(680, 'sine', 0.08, 0.04);
    const randomMsg = prompts[Math.floor(Math.random() * prompts.length)];
    setSpeech(randomMsg);
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      {/* Speech Bubble */}
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative mb-3 px-4 py-2 rounded-2xl bg-[#0D1424] border border-cyan-500/40 shadow-xl shadow-cyan-950/40 text-center max-w-[220px]"
      >
        <span className="text-xs font-semibold text-cyan-300 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
          {speech}
        </span>
        {/* Pointer Arrow */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#0D1424]" />
      </motion.div>

      {/* 3D Robot Image */}
      <motion.div
        animate={{
          y: [0, -8, 0],
          rotate: [0, 1.5, -1.5, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        whileHover={{ scale: 1.1 }}
        onClick={handleMascotClick}
        className="relative cursor-pointer group"
      >
        <div className="absolute inset-0 bg-cyan-400/20 blur-xl rounded-full group-hover:bg-cyan-400/40 transition-colors" />
        <img
          src="/11_learning_robot.png"
          alt="Nexus AI Robot"
          className="w-32 h-32 sm:w-36 sm:h-36 object-contain drop-shadow-2xl relative z-10"
        />
      </motion.div>

      {/* Floating Pulse Ring */}
      <div className="w-20 h-2.5 rounded-full bg-cyan-400/20 blur-sm mt-1" />
    </div>
  );
}

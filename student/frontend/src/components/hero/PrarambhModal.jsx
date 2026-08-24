import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  BookOpen,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { playTone } from '../../utils/sound';

export default function PrarambhModal({ isOpen, onClose }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Video time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    playTone(600, 'triangle', 0.08, 0.05);
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  const handleScrub = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * (duration || 525);
    setProgress(pos * 100);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const jumpToTime = (seconds) => {
    setCurrentTime(seconds);
    setProgress((seconds / (duration || 525)) * 100);
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (timeInSec) => {
    const mins = Math.floor(timeInSec / 60);
    const secs = Math.floor(timeInSec % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const chapters = [
    { seconds: 0, time: '00:00', title: 'The Ancient Spirit of Nalanda in the Digital Age' },
    { seconds: 30, time: '00:30', title: 'Pillar 1: Communicate — Breaking Global Borders' },
    { seconds: 60, time: '01:00', title: 'Pillar 2: Compute — Algorithmic Mastery' },
    { seconds: 90, time: '01:30', title: 'Pillar 3: Create — Building Real Solutions' },
    { seconds: 120, time: '02:00', title: 'Nexus Ecosystem: Mentors, Sandbox & Future' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-xl"
        />

        {/* Modal Content Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-4xl bg-[#0D1424] border border-white/15 rounded-3xl overflow-hidden shadow-2xl shadow-purple-950/40 text-white z-10 my-auto"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0A1020]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-base sm:text-lg text-white">
                  PRARAMBH — Where the Journey Begins
                </h3>
                <p className="text-xs text-slate-400">
                  The Genesis and Philosophy of Nalanda Nexus
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Video Player Display Area */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group">
            {/* HTML5 Video Source Handler */}
            <video
              ref={videoRef}
              src="/PRARAMBH.mp4"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain bg-black"
              playsInline
              controls={false}
            />

            {/* Centered Play/Pause Trigger Overlay when paused */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute z-20 w-16 h-16 rounded-full bg-cyan-500/80 border-2 border-cyan-400 backdrop-blur-md flex items-center justify-center text-slate-950 shadow-2xl hover:scale-110 transition-all"
              >
                <Play className="w-7 h-7 fill-slate-950 ml-1" />
              </button>
            )}

            {/* Video Controls Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-2 z-20">
              {/* Progress Scrub Bar */}
              <div
                onClick={handleScrub}
                className="w-full bg-white/20 hover:bg-white/30 h-2 rounded-full overflow-hidden cursor-pointer transition-all"
              >
                <div
                  className="bg-gradient-to-r from-purple-500 to-cyan-400 h-full rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="hover:text-white"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={toggleMute}
                    className="hover:text-white"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <span className="font-mono">
                    {formatTime(currentTime)} / {formatTime(duration || 0)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-cyan-400 font-mono">1080p HD</span>
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.requestFullscreen?.();
                      }
                    }}
                    className="hover:text-white"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chapters & Story Synopsis */}
          <div className="p-6 bg-[#0A1020] border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <h4 className="font-heading font-semibold text-sm text-white mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                About the PRARAMBH Initiative
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Nalanda Nexus traces its philosophical roots to the ancient Nalanda University—the world's foremost residential center of learning that brought global scholars together. PRARAMBH encapsulates our mission to reinvent this spirit for the 21st century through decentralized mentorship, hands-on computing labs, and collaborative open-source creation.
              </p>
            </div>

            <div>
              <h4 className="font-heading font-semibold text-sm text-white mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Chapters
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-400">
                {chapters.map((ch, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 hover:text-white cursor-pointer transition-colors"
                    onClick={() => jumpToTime(ch.seconds)}
                  >
                    <span className="text-cyan-400 font-mono text-[11px] shrink-0">
                      {ch.time}
                    </span>
                    <span className="truncate">{ch.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

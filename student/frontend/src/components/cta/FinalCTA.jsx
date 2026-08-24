import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSuccessChime, playErrorBuzzer, playKeyStroke } from '../../utils/sound';

export default function FinalCTA() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email.trim()) {
      playErrorBuzzer();
      setStatus('error');
      setErrorMsg('Please enter your email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      playErrorBuzzer();
      setStatus('error');
      setErrorMsg('Please enter a valid email address');
      return;
    }

    setStatus('loading');
    setTimeout(() => {
      setStatus('success');
      playSuccessChime();
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.8 },
        colors: ['#7C3AED', '#06B6D4', '#F97316', '#3B82F6', '#FACC15'],
      });
    }, 800);
  };

  const handleInputChange = (e) => {
    setEmail(e.target.value);
    playKeyStroke(e.target.value.length);
    if (status === 'error') {
      setStatus('idle');
      setErrorMsg('');
    }
  };

  return (
    <section className="relative py-12 sm:py-16 lg:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Radiant Gradient Banner Container matching template */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative rounded-3xl p-6 sm:p-10 lg:p-12 overflow-hidden border border-white/20 shadow-2xl bg-gradient-to-r from-[#200D43] via-[#101438] to-[#0A2552]"
      >
        {/* Ambient Flares */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
          
          {/* Left: Mascot + Copy Container */}
          <div className="lg:col-span-7 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* 3D Robot Mascot using 11_learning_robot.png */}
            <motion.div
              animate={{
                y: [0, -6, 0],
                rotate: [0, 1.5, -1.5, 0],
              }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="shrink-0"
            >
              <img
                src="/11_learning_robot.png"
                alt="Nexus Robot Mascot"
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-2xl"
              />
            </motion.div>

            {/* Headline */}
            <div>
              <h2 className="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight leading-tight">
                Start Your Learning Journey <span className="bg-gradient-to-r from-[#C084FC] to-[#A855F7] bg-clip-text text-transparent">Today!</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 mt-2 max-w-md leading-relaxed font-normal">
                Join thousands of learners and build your future with Nalanda Nexus.
              </p>
            </div>
          </div>

          {/* Right: Email Form */}
          <div className="lg:col-span-5">
            {status === 'success' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 sm:p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center gap-3"
              >
                <CheckCircle2 className="w-6 h-6 text-cyan-300 shrink-0" />
                <div>
                  <h4 className="font-heading font-bold text-sm">
                    Welcome to the Nexus! 🎉
                  </h4>
                  <p className="text-xs text-slate-200 mt-0.5">
                    Early-access sent to <span className="font-semibold text-cyan-300">{email}</span>.
                  </p>
                </div>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="w-full">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-1.5 rounded-2xl sm:rounded-full bg-[#0D1424]/80 border border-white/20 backdrop-blur-xl shadow-inner">
                  <input
                    type="email"
                    value={email}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                    className="w-full px-4 py-2.5 bg-transparent text-white placeholder-slate-400 text-xs sm:text-sm outline-none rounded-full"
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-lg shadow-blue-600/30 hover:scale-105 active:scale-95 transition-all shrink-0"
                  >
                    <span>{status === 'loading' ? 'Joining...' : 'Get Started'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Error Message */}
                {status === 'error' && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-300 pl-4">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </form>
            )}
          </div>

        </div>
      </motion.div>
    </section>
  );
}

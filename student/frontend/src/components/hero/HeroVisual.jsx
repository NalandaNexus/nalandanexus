import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import FloatingPillarCard from './FloatingPillarCard';

export default function HeroVisual() {
  const canvasRef = useRef(null);

  // Subtle floating particle network in the holographic dome
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 1.5 + 0.6,
      color: Math.random() > 0.5 ? 'rgba(6, 182, 212, 0.7)' : 'rgba(168, 85, 247, 0.7)',
    }));

    const resizeHandler = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };

    window.addEventListener('resize', resizeHandler);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connecting circuit lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 60) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${0.14 * (1 - dist / 60)})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      // Draw glowing particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 4;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);

  return (
    <div className="relative w-full max-w-[640px] mx-auto lg:max-w-none flex items-center justify-center min-h-[460px] sm:min-h-[520px] lg:min-h-[580px]">
      {/* Background Holographic Glow & Radial Dome */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[360px] sm:w-[480px] lg:w-[560px] h-[360px] sm:h-[480px] lg:h-[560px] rounded-full bg-gradient-to-b from-purple-600/15 via-cyan-500/10 to-transparent blur-3xl" />
        <div className="absolute w-[290px] sm:w-[390px] lg:w-[460px] h-[290px] sm:h-[390px] lg:h-[460px] rounded-full border border-cyan-500/25 shadow-[0_0_60px_rgba(6,182,212,0.15)] animate-pulse-glow" />
      </div>

      {/* Floating Canvas for Network Nodes */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* Floating Pillar Card 1: COMMUNICATE (Top-Left) */}
      <div className="absolute top-2 left-1 sm:left-4 lg:left-4 z-30">
        <FloatingPillarCard type="communicate" />
      </div>

      {/* Floating Pillar Card 2: COMPUTE (Top-Center) */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-24 lg:right-32 z-30">
        <FloatingPillarCard type="compute" />
      </div>

      {/* Floating Pillar Card 3: CREATE (Top-Right) */}
      <div className="absolute top-8 right-0 sm:right-2 lg:right-0 z-30">
        <FloatingPillarCard type="create" />
      </div>

      {/* Main Center Collaborative Learning Artwork Container */}
      <div className="relative z-20 w-full flex flex-col items-center justify-center mt-12 sm:mt-14">
        <div className="relative w-full max-w-[560px] rounded-3xl overflow-hidden shadow-2xl border border-white/20 bg-gradient-to-b from-[#0A1020] via-[#0D162B] to-[#080C16] group">
          
          {/* Actual Rendered Hero Image */}
          <img
            src="/01_hero_nalanda_learning_scene.png"
            alt="Nalanda Nexus Collaborative Learning Scene"
            className="w-full h-auto object-cover rounded-3xl shadow-inner group-hover:scale-102 transition-transform duration-500"
          />

          {/* Subtle Bottom Table Gradient Fade */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#080C15] via-[#080C15]/70 to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

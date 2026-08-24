import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Calendar,
  Video,
  BookOpen,
  Award,
  Users,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Heart,
  Target,
  Brain,
  MessageCircle,
  Mic,
  Share2,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playSuccessChime, playTone } from '../utils/sound';
import { useAuth } from '../context/AuthContext';
import { courseService } from '../services/courseService';
import { paymentService } from '../services/paymentService';

// Presentational-only icon/color cycle for the "What You'll Learn" skill
// cards — the SKILL NAMES themselves come from the real course.skills
// field (see below); this is just visual assignment, not business data.
const SKILL_ICON_CYCLE = [
  { icon: Users, bgGlow: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
  { icon: MessageCircle, bgGlow: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' },
  { icon: Heart, bgGlow: 'bg-orange-500/10 border-orange-500/30 text-orange-400' },
  { icon: Target, bgGlow: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  { icon: Mic, bgGlow: 'bg-pink-500/10 border-pink-500/30 text-pink-400' },
  { icon: Brain, bgGlow: 'bg-sky-500/10 border-sky-500/30 text-sky-400' },
];

export default function CourseDetail() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const { user, isAuthenticated } = useAuth();

  const [course, setCourse] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setCourse(null);
    setNotFound(false);
    courseService
      .getPublicCourse(slug)
      .then((data) => {
        if (!cancelled) setCourse(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const isEnrolled = Boolean(course?.isEnrolled);
  const priceLabel = course ? `₹${(course.priceInPaise / 100).toLocaleString('en-IN')}` : '—';
  const isPrarambh = slug === 'prarambh';

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/courses/${slug}` } } });
      return;
    }

    setIsPurchasing(true);
    setPurchaseError('');
    try {
      await paymentService.purchaseCourse({
        courseSlug: slug,
        studentName: user?.name,
        studentEmail: user?.email,
      });
      playSuccessChime();
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.7 },
        colors: ['#D97706', '#9333EA', '#06B6D4', '#10B981', '#F59E0B'],
      });
      setCourse((prev) => (prev ? { ...prev, isEnrolled: true } : prev));
      setTimeout(() => navigate('/student/dashboard'), 1200);
    } catch (err) {
      setPurchaseError(err.message || 'Payment could not be completed. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    playTone(600, 'sine', 0.05, 0.03);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (notFound) {
    return (
      <div className="min-h-screen pt-28 pb-24 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="font-heading font-bold text-2xl text-slate-900 dark:text-white mb-3">Course not found</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          The course you're looking for doesn't exist or is no longer published.
        </p>
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-sm font-semibold text-amber-500 hover:text-amber-400"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Course Catalog</span>
        </Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen pt-28 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  // "What You'll Learn" cards - titles come from the real course.skills
  // array; icon/color assignment cycles through SKILL_ICON_CYCLE purely
  // for presentation (no fabricated per-skill descriptions).
  const skillModules = (course.skills || []).map((skill, i) => ({
    id: `skill-${i}`,
    title: skill,
    ...SKILL_ICON_CYCLE[i % SKILL_ICON_CYCLE.length],
  }));

  return (
    <div className="min-h-screen pt-28 pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Back Button */}
      <Link
        to="/learn"
        className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-amber-500 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Course Catalog</span>
      </Link>

      {/* Main PRARAMBH Presentation Card Container */}
      <div className="relative rounded-3xl overflow-hidden border border-amber-500/30 bg-gradient-to-b from-[#0B0C14] via-[#0E111F] to-[#080B15] shadow-2xl p-6 sm:p-10 lg:p-12 text-white">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

        {/* Top Bar: Brand & Foundation Course Pill */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt="Nalanda Nexus Logo"
              className="w-10 h-10 rounded-full object-cover shadow ring-1 ring-white/20"
            />
            <div>
              <h4 className="font-heading font-bold text-base text-white">
                Nalanda Nexus
              </h4>
              <span className="text-xs text-slate-400 -mt-0.5 block">
                Learn. Create. Connect.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied!' : 'Share'}</span>
            </button>

            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-bold tracking-wider uppercase">
              <Calendar className="w-3.5 h-3.5" />
              <span>{course.duration} Course</span>
            </div>
          </div>
        </div>

        {/* Hero Section: Titles, Descriptions & Temple Graphic */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-8 sm:my-12">
          
          {/* Left Column: Vedic Shloka, Gold Titles & Bilingual Text */}
          <div className="lg:col-span-6 space-y-5 text-left">
            {isPrarambh && (
              <div className="inline-flex items-center gap-2 text-amber-400 font-serif text-sm tracking-widest">
                <BookOpen className="w-4 h-4" />
                <span>|| विद्या ददाति विनयं ||</span>
              </div>
            )}

            {/* Giant Title - real course.title / course.subtitle, never hardcoded */}
            <div>
              <h1 className="font-serif font-black text-4xl sm:text-5xl lg:text-6xl text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 tracking-wider">
                {course.title}
              </h1>
              {course.subtitle && (
                <span className="block font-serif font-semibold text-sm sm:text-base text-amber-300 tracking-[0.3em] uppercase mt-1">
                  {course.subtitle}
                </span>
              )}
            </div>

            {course.tagline && (
              <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-white tracking-tight pt-2">
                {course.tagline}
              </h3>
            )}

            {/* Description - real course.description */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
              {course.description}
            </p>

            {/* Bespoke bilingual flourish - kept only for Prarambh, the one
                course this Hindi marketing copy was actually written for;
                other courses simply don't render this block. */}
            {isPrarambh && (
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal pt-2 border-t border-white/10">
                PRARAMBH में आपका स्वागत है – यह आपकी आत्मविश्वास और संचार कौशल (Communication Skills) को निखारने की पहली सीढ़ी है। यह 3 महीने का फाउंडेशन कोर्स इस तरह से तैयार किया गया है कि आप अपने अंदर की क्षमता को पहचान सकें और उसे सही दिशा में विकसित कर सकें। यह कार्यक्रम आपको आवश्यक कौशल प्रदान करता है ताकि आप व्यक्तिगत विकास को अपनाकर जीवन के विभिन्न क्षेत्रों में सफलता प्राप्त कर सकें। चाहे आपका लक्ष्य आपसी रिश्तों को मजबूत बनाना हो, करियर में आगे बढ़ना हो, या बस खुद को अधिक आत्मविश्वासी महसूस करना हो, PRARAMBH आपको हर कदम पर मार्गदर्शन और समर्थन देता है। PRARAMBH के साथ अपने बेहतर भविष्य की शुरुआत करें।
              </p>
            )}
          </div>

          {/* Right Column: Hero Visual Graphic Banner - real course.bannerImage */}
          <div className="lg:col-span-6 relative rounded-3xl overflow-hidden border border-amber-500/40 shadow-2xl group">
            <img
              src={course.bannerImage}
              alt={course.title}
              className="w-full h-auto object-cover rounded-3xl group-hover:scale-102 transition-transform duration-500"
            />
          </div>

        </div>

        {/* WHAT YOU'LL LEARN Header */}
        <div className="text-center my-8 pt-8 border-t border-white/10">
          <span className="text-xs font-bold tracking-[0.25em] text-slate-300 uppercase">
            WHAT YOU'LL LEARN
          </span>
        </div>

        {/* Skills Grid - driven by the real course.skills array */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
          {skillModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-400/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border ${mod.bgGlow} mb-3`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="font-heading font-bold text-xs text-white leading-tight uppercase mb-1.5">
                    {mod.title}
                  </h4>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Enrollment Strip matching template image */}
        <div className="rounded-2xl sm:rounded-3xl bg-[#090C16] border border-amber-500/40 p-4 sm:p-6 shadow-2xl flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* 5 Course Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 divide-y sm:divide-y-0 sm:divide-x divide-white/10 w-full lg:w-auto text-left">
            <div className="flex items-center gap-2.5 px-2">
              <Calendar className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">DURATION</span>
                <span className="text-xs font-bold text-white">{course.duration}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-2 pt-2 sm:pt-0">
              <Video className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">LESSONS</span>
                <span className="text-xs font-bold text-white">{course.totalLessons} Lessons</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-2 pt-2 sm:pt-0">
              <BookOpen className="w-5 h-5 text-purple-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">LEARNING RESOURCES</span>
                <span className="text-xs font-bold text-white">Workbook + Assignments</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-2 pt-2 sm:pt-0">
              <Award className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">CERTIFICATE</span>
                <span className="text-xs font-bold text-white">Upon Completion</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-2 pt-2 sm:pt-0">
              <Users className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">LEVEL</span>
                <span className="text-xs font-bold text-white">{course.difficulty}</span>
              </div>
            </div>
          </div>

          {/* Pricing & CTA Button */}
          <div className="flex flex-col items-end gap-2 shrink-0 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
            <div className="flex items-center gap-4 w-full justify-between lg:justify-end">
              <div className="font-heading font-black text-2xl sm:text-3xl text-amber-400 tracking-tight">
                {priceLabel}
              </div>

              {isEnrolled ? (
                <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enrolled Successfully! 🎉</span>
                </div>
              ) : (
                <button
                  onClick={handleEnroll}
                  disabled={isPurchasing}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 shadow-xl shadow-purple-600/30 hover:scale-105 active:scale-95 transition-all"
                >
                  {isPurchasing ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{isAuthenticated ? 'ENROLL NOW' : 'LOG IN TO ENROLL'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
            {purchaseError && (
              <p className="text-xs font-semibold text-red-400 max-w-xs text-right">{purchaseError}</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

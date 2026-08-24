import React from 'react';
import Hero from '../components/hero/Hero';
import StatsSection from '../components/stats/StatsSection';
import PillarsSection from '../components/pillars/PillarsSection';
import FeatureStrip from '../components/features/FeatureStrip';
import ExploreCourses from '../components/courses/ExploreCourses';
import AnnouncementsSection from '../components/announcements/AnnouncementsSection';
import CommunityImpactSection from '../components/community/CommunityImpactSection';
import FinalCTA from '../components/cta/FinalCTA';

export default function Home() {
  return (
    <div className="relative overflow-hidden">
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Glassmorphism Statistics Bar */}
      <StatsSection />

      {/* 3. The 3 Pillars of the Digital Age */}
      <PillarsSection />

      {/* 4. Horizontal Feature Strip (Smart Learning, Live Classes, Real Projects, Certificates, Community) */}
      <FeatureStrip />

      {/* 5a. Announcements — real, backend-driven, left-aligned panel */}
      <AnnouncementsSection />

      {/* 5b. Explore Learning (Filters + Popular Courses 5-card grid) */}
      <ExploreCourses />

      {/* 6. 3-Column Community & Real Impact Section (Community Stats, Story Video Card, Real Impact Testimonial) */}
      <CommunityImpactSection />

      {/* 7. Final CTA Banner with Robot Mascot */}
      <FinalCTA />
    </div>
  );
}

import React from 'react';
import { Layers, Users, FileCheck2, TrendingUp, Calendar } from 'lucide-react';
import StatCard from './StatCard';

export default function StatsGrid({ stats, onOpenAvgScoreModal }) {
  if (!stats) return null;

  return (
    <section aria-labelledby="core-stats-heading" className="space-y-2">
      <h3 id="core-stats-heading" className="sr-only">Core Institutional Metrics</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <StatCard
          label="Total Classes"
          value={stats.totalClasses?.value ?? 0}
          subtext={stats.totalClasses?.trend || 'No classes yet'}
          icon={Layers}
        />

        <StatCard
          label="Total Students"
          value={stats.totalStudents?.value ?? 0}
          subtext={stats.totalStudents?.trend || 'No students yet'}
          icon={Users}
        />

        <StatCard
          label="Submissions to Grade"
          value={stats.assignments?.value ?? 0}
          subtext={stats.assignments?.trend || 'No assignments yet'}
          icon={FileCheck2}
        />

        <StatCard
          label="Class Average Score"
          value={`${stats.avgScore?.value ?? 0}%`}
          subtext={stats.avgScore?.trend || 'No graded work yet'}
          icon={TrendingUp}
          isInteractive
          onClick={onOpenAvgScoreModal}
        />

        <StatCard
          label="Today's Lectures"
          value={stats.todaysClasses?.value ?? 0}
          subtext={stats.todaysClasses?.trend || 'No sessions today'}
          icon={Calendar}
        />
      </div>
    </section>
  );
}

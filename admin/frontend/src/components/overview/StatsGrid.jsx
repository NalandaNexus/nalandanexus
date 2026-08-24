import React from 'react';
import StatCard from './StatCard';
import { Users, GraduationCap, BookOpen, Activity } from 'lucide-react';

// Honest empty shape — used only if the backend response is ever missing a
// field, never a plausible-looking fake number pretending to be real data.
const EMPTY_KPI = { value: 0, trend: 'No data yet', isPositive: true };

export default function StatsGrid({ kpiData }) {
  const students = kpiData?.students || EMPTY_KPI;
  const teachers = kpiData?.teachers || EMPTY_KPI;
  const courses = kpiData?.courses || EMPTY_KPI;
  const activeLearners = kpiData?.activeLearners || EMPTY_KPI;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total Students" value={students.value} trend={students.trend} isPositive={students.isPositive} icon={Users} />
      <StatCard title="Faculty & Teachers" value={teachers.value} trend={teachers.trend} isPositive={teachers.isPositive} icon={GraduationCap} />
      <StatCard title="Published Courses" value={courses.value} trend={courses.trend} isPositive={courses.isPositive} icon={BookOpen} />
      <StatCard title="Active Learners" value={activeLearners.value} trend={activeLearners.trend} isPositive={activeLearners.isPositive} icon={Activity} />
    </section>
  );
}

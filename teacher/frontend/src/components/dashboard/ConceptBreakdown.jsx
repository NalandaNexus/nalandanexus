import React from 'react';
import { BookOpen, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function ConceptBreakdown({
  concepts,
  onReteachConcept,
  onViewStrugglingStudents,
}) {
  if (!concepts || concepts.length === 0) return null;

  return (
    <section aria-labelledby="concept-breakdown-heading" className="p-5 sm:p-6 rounded-2xl bg-[#FFFFFF] border border-[#DFDACB] space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-[#22355E]" />
          <h3 id="concept-breakdown-heading" className="text-base sm:text-lg font-bold text-[#22355E] font-display">
            Concept-Wise Knowledge Gap Diagnostics
          </h3>
        </div>
        <p className="text-xs text-[#6E6A64] mt-0.5">
          Identify specific syllabus domains where class proficiency drops below target benchmarks, across all your classes.
        </p>
      </div>

      {/* Concept Performance Bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {concepts.map((concept) => {
          const isGap = concept.score < 75;
          const isHealthy = concept.score >= 85;

          return (
            <div
              key={concept.id}
              className="p-4 rounded-xl bg-[#F7F5EE] border border-[#DFDACB] flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#22355E]">{concept.name}</span>
                  <span
                    className={`text-xs font-extrabold font-mono tabular-nums ${
                      isGap ? 'text-[#C1352B]' : isHealthy ? 'text-[#5C7A5E]' : 'text-[#8F6A15]'
                    }`}
                  >
                    {concept.score}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-[#EDEAE0] rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isGap ? 'bg-[#C1352B]' : isHealthy ? 'bg-[#5C7A5E]' : 'bg-[#C99A2E]'
                    }`}
                    style={{ width: `${concept.score}%` }}
                  />
                </div>

                {/* Supporting Gap Info */}
                <div className="flex items-center justify-between text-[11px] text-[#6E6A64] mt-2">
                  <span>Class Mean: {concept.classAverage}%</span>
                  {concept.belowThresholdCount > 0 ? (
                    <span className="text-[#C1352B] font-bold">
                      {concept.belowThresholdCount} students &lt;60%
                    </span>
                  ) : (
                    <span className="text-[#5C7A5E] font-semibold">Cohort on track</span>
                  )}
                </div>
              </div>

              {/* Reteach CTA Button (Brick Terracotta: #AB5236) */}
              <div className="pt-2 border-t border-[#DFDACB]/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onViewStrugglingStudents && onViewStrugglingStudents(concept.id)}
                  className="text-[11px] text-[#22355E] hover:underline font-bold"
                >
                  View Students
                </button>

                <button
                  type="button"
                  onClick={() => onReteachConcept && onReteachConcept(concept.id)}
                  className="px-3 py-1 rounded-lg bg-[#AB5236] hover:bg-[#94452C] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                >
                  Create Revision <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

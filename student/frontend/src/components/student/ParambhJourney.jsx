import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleDot, Lock, ArrowRight, Compass } from 'lucide-react';
import { useStudent } from '../../context/StudentContext';

export default function ParambhJourney() {
  const { journeyStages } = useStudent();

  const getStageIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-[#5C7A5E]" />;
      case 'current':
        return <CircleDot className="w-4 h-4 text-[#AB5236] animate-pulse" />;
      case 'locked':
      default:
        return <Lock className="w-3.5 h-3.5 text-[#2B2B28]/40" />;
    }
  };

  const getStageBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="text-[10px] font-semibold text-[#5C7A5E] bg-[#5C7A5E]/10 px-1.5 py-0.5 rounded">
            Completed
          </span>
        );
      case 'current':
        return (
          <span className="text-[10px] font-bold text-[#AB5236] bg-[#AB5236]/10 px-1.5 py-0.5 rounded">
            In Progress
          </span>
        );
      case 'locked':
      default:
        return (
          <span className="text-[10px] font-medium text-[#2B2B28]/40 bg-[#EDEAE0] px-1.5 py-0.5 rounded">
            Locked
          </span>
        );
    }
  };

  return (
    <section aria-labelledby="journey-heading">
      <div className="bg-[#FAF9F4] border border-[#DFDACB] rounded-2xl p-5 sm:p-6 shadow-xs">
        {/* Section Header */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#22355E]" />
            <h2
              id="journey-heading"
              className="font-display font-bold text-sm sm:text-base text-[#22355E] tracking-tight"
            >
              Parambh Journey
            </h2>
          </div>
          <Link
            to="/student/parambh"
            className="text-xs font-semibold text-[#22355E] hover:text-[#AB5236] flex items-center gap-1 transition-colors"
          >
            <span>View Syllabus</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Stages Progression Horizontal Bar on Desktop / Stacked on Mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          {journeyStages.map((stage) => {
            const isCurrent = stage.status === 'current';
            const isCompleted = stage.status === 'completed';

            return (
              <div
                key={stage.id}
                className={`p-3 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-white border-[#AB5236] shadow-xs ring-1 ring-[#AB5236]/20'
                    : isCompleted
                    ? 'bg-[#F2EFE6] border-[#DFDACB]'
                    : 'bg-[#FAF9F4] border-[#DFDACB]/60 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-data font-bold text-[10px] text-[#2B2B28]/60 uppercase">
                    Stage {stage.number}
                  </span>
                  {getStageIcon(stage.status)}
                </div>

                <h3
                  className={`font-heading font-bold text-xs truncate ${
                    isCurrent
                      ? 'text-[#AB5236]'
                      : isCompleted
                      ? 'text-[#22355E]'
                      : 'text-[#2B2B28]/60'
                  }`}
                >
                  {stage.name}
                </h3>

                <p className="text-[10px] text-[#2B2B28]/65 line-clamp-1 mt-0.5 mb-2">
                  {stage.description}
                </p>

                <div>{getStageBadge(stage.status)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

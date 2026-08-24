import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, Clock, ShieldAlert, ArrowRight } from 'lucide-react';

export default function NeedsAttention({ items = [] }) {
  const navigate = useNavigate();

  if (!items || items.length === 0) {
    return (
      <div className="bg-white border border-[#DFDACB] rounded-2xl p-4 sm:p-5 shadow-card">
        <div className="flex items-center gap-2 text-xs font-bold text-[#5C7A5E]">
          <span className="w-2 h-2 rounded-full bg-[#5C7A5E]" />
          <span>All operational checks nominal — No urgent administrative triage required.</span>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-[#22355E] tracking-wider uppercase">
            Needs Your Attention
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#C99A2E]/15 text-[#C99A2E] border border-[#C99A2E]/30 font-mono">
            {items.length} Pending
          </span>
        </div>
        <span className="text-[11px] text-[#9B9690]">Immediate triage queue</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((item) => {
          const isBlocked = item.severity === 'blocked';
          const isAttention = item.severity === 'attention';

          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between shadow-card hover:shadow-hover ${
                isBlocked
                  ? 'bg-white border-[#C1352B]/40 hover:border-[#C1352B]'
                  : 'bg-white border-[#C99A2E]/40 hover:border-[#C99A2E]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        isBlocked ? 'bg-[#C1352B]' : 'bg-[#C99A2E]'
                      }`}
                    />
                    <span
                      className={`text-xs font-bold ${
                        isBlocked ? 'text-[#C1352B]' : 'text-[#C99A2E]'
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#EDEAE0] text-[#22355E]">
                    {item.count}
                  </span>
                </div>

                <p className="text-xs text-[#2B2B28]/80 leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(item.linkTo)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  isBlocked
                    ? 'bg-[#C1352B]/10 hover:bg-[#C1352B] text-[#C1352B] hover:text-white'
                    : 'bg-[#C99A2E]/10 hover:bg-[#C99A2E] text-[#C99A2E] hover:text-white'
                }`}
              >
                <span>{item.actionText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

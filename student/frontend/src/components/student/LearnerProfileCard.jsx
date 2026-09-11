import React from 'react';
import { Flame, Trophy, Lock, CheckCircle2, Award } from 'lucide-react';

/**
 * The Digital Learner Profile.
 *
 * Every number on this card arrives from the backend already computed. There is
 * deliberately no arithmetic here beyond turning a score into a bar width: XP,
 * level, rank, the skill scores, overall power and the eligibility verdict are
 * all decided server-side, and a copy of that logic living here would be a
 * second answer to questions that must only have one.
 *
 * Renders an honest empty state rather than placeholder figures - a learner who
 * has not started anything has zeroes, and showing invented numbers would
 * misrepresent their progress on the one screen meant to describe it.
 */

const pct = (n) => `${Math.max(0, Math.min(100, Number(n) || 0))}%`;

function Stat({ label, value, sub }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-[#2B2B28]/45">{label}</p>
      <p className="font-data font-black text-lg text-[#22355E] tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-[#2B2B28]/50 truncate">{sub}</p>}
    </div>
  );
}

function SkillBar({ skill }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-xs font-heading font-bold text-[#2B2B28] truncate">{skill.name}</span>
        <span className="font-data text-xs text-[#22355E] tabular-nums shrink-0">{Math.round(skill.score)}</span>
      </div>
      <div
        className="h-2 rounded-full bg-[#2B2B28]/8 overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(skill.score)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${skill.name} score`}
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: pct(skill.score), backgroundColor: skill.color }} />
      </div>
      {skill.activityCount === 0 && (
        // Says why a bar is empty. Without this, "0" reads as a poor score
        // rather than as work not yet started.
        <p className="text-[10px] text-[#2B2B28]/40 mt-0.5">No activity yet</p>
      )}
    </div>
  );
}

export default function LearnerProfileCard({ data, loading = false }) {
  if (loading) {
    return (
      <div className="p-5 rounded-2xl bg-white border border-[#DFDACB] animate-pulse space-y-3" aria-busy="true">
        <div className="h-4 w-40 bg-[#2B2B28]/10 rounded" />
        <div className="h-2 w-full bg-[#2B2B28]/10 rounded" />
        <div className="h-2 w-2/3 bg-[#2B2B28]/10 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const { stage, level, rank, xp, skills = [], scores = {}, attendance = {}, streak = {}, stats = {}, achievements = [], nextStage } = data;
  const xpPercent = xp?.forNextLevel ? (xp.intoLevel / xp.forNextLevel) * 100 : 0;
  const unlocked = achievements.filter((a) => a.unlocked);

  return (
    <section className="rounded-2xl bg-white border border-[#DFDACB] overflow-hidden">
      {/* Identity */}
      <header className="p-5 bg-[#22355E] text-white">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">Digital Learner Profile</p>
        <h2 className="font-heading font-black text-xl mt-0.5 truncate">{data.username}</h2>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="px-2.5 py-1 rounded-lg bg-white/12 text-xs font-heading font-bold">Level {level}</span>
          {rank?.code && (
            <span className="px-2.5 py-1 rounded-lg bg-[#C99A2E] text-[#2B2B28] text-xs font-heading font-bold" title={rank.name || ''}>
              Rank {rank.code}
            </span>
          )}
          {stage && (
            <span className="px-2.5 py-1 rounded-lg bg-white/12 text-xs font-heading font-bold truncate">
              {stage.name} — {stage.tagline}
            </span>
          )}
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-[11px] text-white/70 mb-1">
            <span>XP</span>
            <span className="font-data tabular-nums">
              {(xp?.intoLevel ?? 0).toLocaleString('en-IN')} / {(xp?.forNextLevel ?? 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/15 overflow-hidden" role="progressbar" aria-valuenow={Math.round(xpPercent)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level">
            <div className="h-full rounded-full bg-[#C99A2E] transition-[width] duration-500" style={{ width: pct(xpPercent) }} />
          </div>
          <p className="text-[10px] text-white/50 mt-1 font-data">{(xp?.current ?? 0).toLocaleString('en-IN')} XP total</p>
        </div>
      </header>

      {/* Skills */}
      <div className="p-5 space-y-3 border-b border-[#DFDACB]">
        {skills.length ? (
          skills.map((s) => <SkillBar key={s.code} skill={s} />)
        ) : (
          <p className="text-xs text-[#2B2B28]/50">Skill tracking starts with your first lesson.</p>
        )}
      </div>

      {/* Derived figures */}
      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 border-b border-[#DFDACB]">
        <Stat label="Overall Power" value={Math.round(scores.overallPower || 0)} />
        <Stat
          label="Attendance"
          value={attendance.conducted ? `${Math.round(scores.attendance || 0)}%` : '—'}
          sub={attendance.conducted ? `${attendance.attended} of ${attendance.conducted} classes` : 'No classes recorded'}
        />
        <Stat label="Knowledge" value={Math.round(scores.knowledge || 0)} />
        <Stat label="Consistency" value={Math.round(scores.consistency || 0)} />
        <Stat label="Lessons" value={stats.lessonsCompleted || 0} />
        <Stat label="Achievements" value={stats.achievementsUnlocked || 0} />
      </div>

      {/* Streak */}
      <div className="px-5 py-3 flex items-center gap-2 border-b border-[#DFDACB]">
        <Flame className={`w-4 h-4 ${streak.current > 0 ? 'text-[#AB5236]' : 'text-[#2B2B28]/25'}`} />
        <p className="text-xs text-[#2B2B28]/70">
          {streak.current > 0 ? (
            <>
              <strong className="text-[#2B2B28]">{streak.current} day streak</strong>
              {streak.longest > streak.current && <span className="text-[#2B2B28]/50"> · best {streak.longest}</span>}
            </>
          ) : (
            'Complete something today to start a streak'
          )}
        </p>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="p-5 border-b border-[#DFDACB]">
          <div className="flex items-center gap-1.5 mb-3">
            <Trophy className="w-3.5 h-3.5 text-[#C99A2E]" />
            <h3 className="text-xs font-heading font-bold text-[#22355E]">
              Achievements <span className="text-[#2B2B28]/40 font-normal">{unlocked.length} of {achievements.length}</span>
            </h3>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {achievements.map((a) => (
              <li
                key={a.code}
                title={a.description}
                className={`p-2.5 rounded-xl border text-center ${
                  a.unlocked ? 'bg-[#C99A2E]/10 border-[#C99A2E]/30' : 'bg-[#2B2B28]/[0.03] border-[#DFDACB] opacity-60'
                }`}
              >
                {a.unlocked ? (
                  <Award className="w-4 h-4 mx-auto text-[#C99A2E]" />
                ) : (
                  <Lock className="w-4 h-4 mx-auto text-[#2B2B28]/30" />
                )}
                <p className="text-[10px] font-heading font-bold text-[#2B2B28] mt-1 leading-tight">{a.name}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What the next stage needs */}
      {nextStage && (
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-xs font-heading font-bold text-[#22355E]">
              {nextStage.name} — {nextStage.tagline}
            </h3>
            <span
              className={`text-[10px] font-heading font-bold px-2 py-0.5 rounded ${
                nextStage.eligible ? 'bg-[#5C7A5E]/12 text-[#5C7A5E]' : 'bg-[#2B2B28]/8 text-[#2B2B28]/60'
              }`}
            >
              {nextStage.eligible ? 'UNLOCKED' : 'LOCKED'}
            </span>
          </div>

          {nextStage.checks?.length ? (
            // The requirement list, met and unmet alike. A locked stage that
            // cannot say what it wants is just a wall.
            <ul className="space-y-1.5">
              {nextStage.checks.map((c) => (
                <li key={c.key} className="flex items-center gap-2 text-xs">
                  {c.met ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#5C7A5E] shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-[#2B2B28]/20 shrink-0" />
                  )}
                  <span className={`min-w-0 truncate ${c.met ? 'text-[#2B2B28]/60' : 'text-[#2B2B28]'}`}>{c.label}</span>
                  <span className="ml-auto font-data tabular-nums text-[11px] text-[#2B2B28]/60 shrink-0">
                    {Math.round(c.actual)} / {Math.round(c.required)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[#2B2B28]/50">Requirements for this stage have not been set yet.</p>
          )}
        </div>
      )}
    </section>
  );
}

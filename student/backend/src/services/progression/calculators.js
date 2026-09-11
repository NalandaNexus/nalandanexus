/**
 * Every arithmetic decision the progression engine makes.
 *
 * Pure functions, no database and no models: a student disputing a number
 * should be answerable by reading one file, and these are the only places a
 * score is actually produced. The engine's job is to gather inputs and persist
 * outputs; the judgement lives here.
 */

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n) => Math.round(n * 10) / 10;

/**
 * Averages components against configured weights, counting only those that have
 * data.
 *
 * This is the rule that keeps early scores honest. A student three lessons into
 * a subject has no quiz results yet; scoring them against a quiz weight of 40
 * would report a low number that describes the syllabus rather than the
 * student. Weights are therefore relative, renormalised over whatever exists.
 *
 * Returns null - not zero - when nothing has data at all, so callers can tell
 * "no evidence" apart from "evidence of zero".
 */
export function weightedAverage(components) {
  const present = components.filter((c) => c.hasData && c.weight > 0);
  if (!present.length) return null;
  const totalWeight = present.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight <= 0) return null;
  return clamp(present.reduce((sum, c) => sum + c.value * c.weight, 0) / totalWeight);
}

/**
 * Level, and how far through it the student is.
 *
 * LINEAR reproduces the platform's original `floor(xp / 500) + 1` exactly, so
 * introducing configurable levels does not move anybody who already had one.
 * TABLE exists for a hand-authored curve where early levels come faster.
 */
export function levelForXp(xp, levelRules = {}) {
  const totalXp = Math.max(0, Math.floor(xp || 0));
  const maxLevel = levelRules.maxLevel || 100;

  if (levelRules.mode === 'TABLE' && (levelRules.table || []).length) {
    const table = [...levelRules.table].sort((a, b) => a.requiredXP - b.requiredXP);
    let level = 1;
    let floorXp = 0;
    let nextXp = table[0]?.requiredXP ?? 0;
    for (const row of table) {
      if (totalXp >= row.requiredXP) {
        level = row.level;
        floorXp = row.requiredXP;
      } else {
        nextXp = row.requiredXP;
        return {
          level: Math.min(level, maxLevel),
          currentLevelXP: totalXp - floorXp,
          nextLevelXP: Math.max(1, nextXp - floorXp),
          totalXp,
        };
      }
    }
    // Past the end of the table: capped, with a full bar rather than a
    // meaningless "needs 0 more".
    return { level: Math.min(level, maxLevel), currentLevelXP: totalXp - floorXp, nextLevelXP: Math.max(1, totalXp - floorXp), totalXp };
  }

  const per = Math.max(1, levelRules.xpPerLevel || 500);
  const level = Math.min(maxLevel, Math.floor(totalXp / per) + 1);
  const floorXp = (level - 1) * per;
  return { level, currentLevelXP: totalXp - floorXp, nextLevelXP: per, totalXp };
}

/**
 * The highest rank whose thresholds the student meets.
 *
 * Requires BOTH level and overall power, so rank cannot be farmed by grinding
 * XP alone while skills, attendance and consistency stay low - which is the
 * distinction that makes rank worth showing beside level rather than being a
 * second name for it.
 */
export function rankFor({ level, overallPower }, ranks = []) {
  const ordered = [...ranks].sort((a, b) => a.order - b.order);
  let current = ordered[0] || null;
  for (const rank of ordered) {
    if (level >= (rank.minLevel || 1) && overallPower >= (rank.minOverallPower || 0)) current = rank;
  }
  return current ? { code: current.code, name: current.name } : { code: null, name: null };
}

/** One subject's 0-100 score from what the student actually did in it. */
export function skillScore(parts, weights = {}) {
  const value = weightedAverage([
    { value: parts.lessonCompletionPercent || 0, weight: weights.lessons ?? 20, hasData: (parts.lessonsAvailable || 0) > 0 },
    { value: parts.quizAverage || 0, weight: weights.quizzes ?? 40, hasData: (parts.quizCount || 0) > 0 },
    { value: parts.taskAverage || 0, weight: weights.tasks ?? 25, hasData: (parts.taskCount || 0) > 0 },
    { value: parts.assessmentAverage || 0, weight: weights.assessments ?? 15, hasData: (parts.assessmentCount || 0) > 0 },
  ]);
  return value === null ? 0 : round(value);
}

/** Academic performance across every subject at once. */
export function knowledgeScore(parts, weights = {}) {
  const value = weightedAverage([
    { value: parts.quizAverage || 0, weight: weights.quizzes ?? 45, hasData: (parts.quizCount || 0) > 0 },
    { value: parts.taskAverage || 0, weight: weights.tasks ?? 30, hasData: (parts.taskCount || 0) > 0 },
    { value: parts.assessmentAverage || 0, weight: weights.assessments ?? 25, hasData: (parts.assessmentCount || 0) > 0 },
  ]);
  return value === null ? 0 : round(value);
}

/**
 * Showing up, measured two ways.
 *
 * A streak rewards an unbroken run; active days over a window rewards turning
 * up often without punishing one missed Sunday. Weighting both means neither a
 * single lapse nor a frantic weekend dominates the number.
 */
export function consistencyScore({ currentStreak = 0, activeDaysInWindow = 0 }, config = {}) {
  const target = Math.max(1, config.targetStreakDays ?? 14);
  const window = Math.max(1, config.windowDays ?? 30);

  const streakPart = clamp((currentStreak / target) * 100);
  const activePart = clamp((activeDaysInWindow / window) * 100);

  const value = weightedAverage([
    { value: streakPart, weight: config.streakWeight ?? 50, hasData: true },
    { value: activePart, weight: config.activeDaysWeight ?? 50, hasData: true },
  ]);
  return value === null ? 0 : round(value);
}

/**
 * Attendance as a percentage, with late marks worth partial credit.
 *
 * Returns `counts` alongside the score so the UI can show "94 of 100 classes"
 * rather than a bare percentage, and `provisional` when there have been too few
 * sessions for the figure to mean anything - the engine reports it but does not
 * let it gate progression.
 */
export function attendanceScore({ present = 0, late = 0, total = 0 }, config = {}) {
  if (total <= 0) return { score: 0, attended: 0, conducted: 0, provisional: true };
  const lateCredit = clamp(config.lateCreditPercent ?? 50) / 100;
  const credited = present + late * lateCredit;
  return {
    score: round(clamp((credited / total) * 100)),
    attended: present + late,
    conducted: total,
    provisional: total < (config.minSessionsForScore ?? 3),
  };
}

/**
 * One number for "how is this student doing".
 *
 * Subject weights come from configuration by code, so adding a fourth subject
 * is a row in the rules document rather than a change here. A subject with no
 * activity yet is excluded rather than counted as zero - otherwise every
 * student's power would start artificially low and climb for reasons that have
 * nothing to do with them.
 */
export function overallPower({ skills = [], attendance = null, knowledge = null, consistency = null }, weights = {}) {
  const subjectWeights = new Map((weights.subjects || []).map((s) => [s.subjectCode, s.weight]));

  const components = skills.map((s) => ({
    value: s.score || 0,
    weight: subjectWeights.get(s.subjectCode) ?? 0,
    hasData: (s.activityCount || 0) > 0,
  }));

  components.push({ value: attendance?.score ?? 0, weight: weights.attendance ?? 10, hasData: (attendance?.conducted || 0) > 0 });
  components.push({ value: knowledge ?? 0, weight: weights.knowledge ?? 20, hasData: knowledge !== null });
  components.push({ value: consistency ?? 0, weight: weights.consistency ?? 10, hasData: consistency !== null });

  const value = weightedAverage(components);
  return value === null ? 0 : round(value);
}

/** Percentage of a stage's published lessons the student has completed. */
export function stageProgress({ lessonsCompleted = 0, lessonsAvailable = 0 }) {
  if (lessonsAvailable <= 0) return 0;
  return round(clamp((lessonsCompleted / lessonsAvailable) * 100));
}

export default {
  weightedAverage,
  levelForXp,
  rankFor,
  skillScore,
  knowledgeScore,
  consistencyScore,
  attendanceScore,
  overallPower,
  stageProgress,
};

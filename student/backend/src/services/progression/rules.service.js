import { ProgressionRules, DEFAULT_XP_RULES, DEFAULT_RANKS } from '../../models/ProgressionRules.js';
import { DEFAULT_SUBJECTS } from '../../models/Subject.js';

/**
 * The one place progression configuration is read from.
 *
 * Cached for a short interval because every activity consults it and the
 * document changes rarely; the window is short enough that an administrator
 * editing a rule sees it take effect without a deploy, and `invalidate` makes
 * that immediate on the instance that handled the edit.
 *
 * Defaults reproduce what the platform did before the engine existed - 500 XP
 * per level, 10 XP for a lecture - so switching this on does not restate
 * anybody's level.
 */

let cached = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

function defaultPowerWeights() {
  // 20/20/20 across the three launch subjects, then attendance, knowledge and
  // consistency - the split the product spec uses as its worked example.
  return {
    subjects: DEFAULT_SUBJECTS.map((s) => ({ subjectCode: s.code, weight: 20 })),
    attendance: 10,
    knowledge: 20,
    consistency: 10,
  };
}

/** Creates the singleton on first use so a fresh deployment is never ruleless. */
export async function ensureRules() {
  const existing = await ProgressionRules.findOne({ key: 'GLOBAL' });
  if (existing) return existing;

  try {
    return await ProgressionRules.create({
      key: 'GLOBAL',
      xpRules: DEFAULT_XP_RULES.map((r) => ({ ...r })),
      ranks: DEFAULT_RANKS.map((r) => ({ ...r })),
      overallPower: defaultPowerWeights(),
    });
  } catch (err) {
    // Two instances can both find nothing and both create; the unique key means
    // exactly one wins and the loser simply reads what the winner wrote.
    if (err?.code === 11000) return ProgressionRules.findOne({ key: 'GLOBAL' });
    throw err;
  }
}

export async function getRules({ fresh = false } = {}) {
  if (!fresh && cached && Date.now() - cachedAt < CACHE_MS) return cached;
  const rules = await ensureRules();
  cached = rules.toObject ? rules.toObject() : rules;
  cachedAt = Date.now();
  return cached;
}

export function invalidateRulesCache() {
  cached = null;
  cachedAt = 0;
}

/**
 * The XP rule for an activity, narrowed by stage and subject when a specific
 * rule exists for them.
 *
 * More specific wins: a rule naming this subject beats one naming only the
 * stage, which beats the general one. Lets an administrator say "cybersecurity
 * quizzes are worth more this term" without duplicating every other rule.
 */
export function findXpRule(rules, { activityType, stageCode = null, subjectCode = null }) {
  const type = String(activityType || '').toUpperCase();
  const candidates = (rules.xpRules || []).filter((r) => r.enabled !== false && r.activityType === type);
  if (!candidates.length) return null;

  const score = (r) => (r.subjectCode === subjectCode ? 2 : 0) + (r.stageCode === stageCode ? 1 : 0);
  const applicable = candidates.filter(
    (r) => (!r.subjectCode || r.subjectCode === subjectCode) && (!r.stageCode || r.stageCode === stageCode)
  );
  if (!applicable.length) return null;

  return applicable.sort((a, b) => score(b) - score(a))[0];
}

export default { getRules, ensureRules, invalidateRulesCache, findXpRule };

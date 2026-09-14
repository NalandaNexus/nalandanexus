import { COMMAND } from './command.js';
import { OPERATIONS } from './operations.js';
import { YODDHA_MASTERY } from './mastery.js';

/**
 * YODDHA — The Warrior. Nine months, eighteen modules, one course.
 *
 * Structured exactly as GARUD: a single course carrying English, Computer and
 * Cybersecurity activities, distinguished only by their own subject tags. The
 * difference between the stages is depth and the amount of ambiguity left in
 * the work, not a different architecture.
 */
export const YODDHA_MODULES = Object.freeze([...COMMAND, ...OPERATIONS, ...YODDHA_MASTERY]);

export default YODDHA_MODULES;

import { FOUNDATION } from './foundation.js';
import { SECURITY } from './security.js';
import { MASTERY } from './mastery.js';

/**
 * GARUD — The Rise. Nine months, eighteen modules, one course.
 *
 * Split across three files by arc rather than by subject, because the course is
 * one course: English, Computer and Cybersecurity activities sit alongside each
 * other inside it and are separated only by their own subject tags. Three
 * subject-specific GARUD courses would break the single progression the stage
 * is built on.
 */
export const GARUD_MODULES = Object.freeze([...FOUNDATION, ...SECURITY, ...MASTERY]);

export default GARUD_MODULES;

import { GARUD_MODULES } from './garud/index.js';
import { YODDHA_MODULES } from './yoddha/index.js';

/**
 * The curriculum for the stages that have one.
 *
 * PRARAMBH is deliberately absent. It has real students, real progress and real
 * payments behind it, and its content was authored before this file existed -
 * seeding it from here would overwrite work that is already live. The seeder
 * only touches courses named here.
 *
 * Keyed by course slug, which is how every part of this system addresses a
 * course across the three databases.
 */
export const CURRICULUM = Object.freeze({
  garud: { slug: 'garud', stageCode: 'GARUD', modules: GARUD_MODULES },
  yoddha: { slug: 'yoddha', stageCode: 'YODDHA', modules: YODDHA_MODULES },
});

export const CURRICULUM_SLUGS = Object.freeze(Object.keys(CURRICULUM));

export default CURRICULUM;

import { Course } from '../../models/Course.js';
import { Stage } from '../../models/Stage.js';
import { Enrollment } from '../../models/Enrollment.js';

/**
 * The three stages of the journey, as courses.
 *
 * Shared by the seed script and the admin endpoint so there is one definition
 * of what the journey is. Running it twice changes nothing; running it against
 * a database where PRARAMBH already lives updates only its duration and leaves
 * its content, price, publication state and every enrolment behind it alone.
 *
 * GARUD and YODDHA are created NOT purchasable on purpose. They exist, they are
 * visible, and the eligibility gate applies to them - what they do not have yet
 * is a price or a payment flow, and a stage that could be taken for nothing is
 * a worse placeholder than one that plainly cannot be taken yet.
 */

export const JOURNEY_DURATION = Object.freeze({ durationValue: 9, durationUnit: 'MONTHS', duration: '9 Months' });

export const JOURNEY = Object.freeze([
  { stageCode: 'PRARAMBH', slug: 'prarambh', createIfMissing: false },
  {
    stageCode: 'GARUD',
    slug: 'garud',
    createIfMissing: true,
    doc: {
      title: 'GARUD — The Rise',
      subtitle: 'Build Your Power',
      tagline: 'Sharpen what you started. Build range, depth and confidence.',
      description:
        'GARUD is the second stage of the Nalanda Nexus journey. It builds on the foundations laid in PRARAMBH, deepening communication, computing and cybersecurity into working capability.',
      category: 'foundation',
      // A default for untagged activities only. GARUD carries all three
      // subjects at the activity level, exactly as PRARAMBH does.
      pillar: 'communicate',
      difficulty: 'Intermediate',
      grades: ['6', '7', '8', '9', '10', '11', '12'],
      priceInPaise: 0,
      isPublished: true,
      isPurchasable: false,
      modules: [],
    },
  },
  {
    stageCode: 'YODDHA',
    slug: 'yoddha',
    createIfMissing: true,
    doc: {
      title: 'YODDHA — The Warrior',
      subtitle: 'Master Your Skills. Lead With Confidence.',
      tagline: 'Lead, present and defend your work in the real world.',
      description:
        'YODDHA is the final stage of the Nalanda Nexus journey. It turns capability into leadership: communicating under pressure, applying computing to real problems, and thinking about security as a practitioner.',
      category: 'foundation',
      pillar: 'communicate',
      difficulty: 'Advanced',
      grades: ['6', '7', '8', '9', '10', '11', '12'],
      priceInPaise: 0,
      isPublished: true,
      isPurchasable: false,
      modules: [],
    },
  },
]);

/**
 * Brings the journey into existence, or reports what it would do.
 *
 * Returns a line per decision rather than a bare success, because "left alone"
 * and "updated" are different outcomes and an operator running this against
 * production deserves to see which happened.
 */
export async function setupJourney({ apply = false } = {}) {
  const courses = [];
  const links = [];

  for (const entry of JOURNEY) {
    const existing = await Course.findOne({ slug: entry.slug });

    if (!existing && !entry.createIfMissing) {
      courses.push({ slug: entry.slug, action: 'MISSING', detail: 'expected an existing course; left alone' });
      continue;
    }

    if (!existing) {
      courses.push({ slug: entry.slug, action: 'CREATE', detail: `${entry.doc.title} (${JOURNEY_DURATION.duration}, not purchasable)` });
      if (apply) await Course.create({ slug: entry.slug, ...entry.doc, ...JOURNEY_DURATION });
      continue;
    }

    const enrolments = await Enrollment.countDocuments({ courseId: existing._id });
    const needsDuration =
      existing.durationValue !== JOURNEY_DURATION.durationValue || existing.durationUnit !== JOURNEY_DURATION.durationUnit;

    if (needsDuration) {
      courses.push({
        slug: entry.slug,
        action: 'UPDATE_DURATION',
        detail: `"${existing.duration || 'none'}" -> ${JOURNEY_DURATION.duration}; ${enrolments} enrolment(s) untouched`,
      });
      // Only the duration. Never the title, price, content or publication state
      // of a course that students are already sitting inside.
      if (apply) await Course.updateOne({ _id: existing._id }, { $set: JOURNEY_DURATION });
    } else {
      courses.push({ slug: entry.slug, action: 'UNCHANGED', detail: `already ${JOURNEY_DURATION.duration}` });
    }
  }

  for (const entry of JOURNEY) {
    const stage = await Stage.findOne({ code: entry.stageCode });
    if (!stage) {
      links.push({ stage: entry.stageCode, action: 'NO_STAGE', detail: 'no stage defined' });
      continue;
    }
    if (stage.courseSlug === entry.slug) {
      links.push({ stage: entry.stageCode, action: 'UNCHANGED', detail: `already linked to ${entry.slug}` });
      continue;
    }
    links.push({ stage: entry.stageCode, action: 'LINK', detail: `${stage.courseSlug || 'none'} -> ${entry.slug}` });
    if (apply) await Stage.updateOne({ _id: stage._id }, { $set: { courseSlug: entry.slug } });
  }

  return { applied: apply, courses, links };
}

export default { setupJourney, JOURNEY, JOURNEY_DURATION };

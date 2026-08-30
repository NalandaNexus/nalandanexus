import { SchoolClass } from '../models/SchoolClass.js';
import { Student } from '../models/Student.js';

/**
 * Chooses which batch of a course a newly-paid enrollment joins.
 *
 * A course (PRARAMBH) runs several batches (PB1, PB2, PB3). Each has a teacher,
 * a capacity of roughly 50-60, and its own lectures. A student buys the COURSE;
 * this decides which batch they actually sit in. The student portal owns the
 * enrollment but cannot make this call - batch ownership and capacity live here.
 *
 * Fills the fullest batch that still has room rather than spreading students
 * evenly: a coaching batch works better closed and taught than three half-empty
 * ones running in parallel.
 */

/**
 * Claims one seat atomically.
 *
 * `$expr` compares two fields of the SAME document inside the update's own match
 * stage, so the capacity test and the increment are one indivisible operation -
 * two simultaneous purchases cannot both be handed the final seat. A
 * check-then-write here would overshoot under exactly the concurrency a launch
 * day produces.
 *
 * Returns the updated batch, or null when it is full (or archived), which is a
 * normal outcome and simply moves the caller to the next batch.
 */
async function claimSeat(batchId) {
  return SchoolClass.findOneAndUpdate(
    {
      _id: batchId,
      status: 'active',
      $expr: { $lt: ['$enrolledCount', { $ifNull: ['$capacity', 60] }] },
    },
    { $inc: { enrolledCount: 1 } },
    { new: true }
  );
}

/** Hands a seat back when the roster write that follows it fails, so a failure never permanently consumes capacity. */
async function releaseSeat(batchId) {
  await SchoolClass.updateOne({ _id: batchId, enrolledCount: { $gt: 0 } }, { $inc: { enrolledCount: -1 } });
}

/**
 * Recomputes a batch's seat count from the roster rows that actually hold one.
 *
 * `enrolledCount` is a cache that enables the atomic claim above, so it needs a
 * source of truth to be reconciled against - enrollment sync calls this after
 * every run. Only verified rows (linkedUserId set, or awaiting the first sync
 * after placement) count; an unverified row a teacher typed in by hand is not a
 * paid seat.
 */
export async function recountBatchSeats(batchId) {
  const taken = await Student.countDocuments({
    class: batchId,
    status: 'active',
    $or: [{ linkedUserId: { $ne: null } }, { enrollmentId: { $ne: null } }],
  });
  await SchoolClass.updateOne({ _id: batchId }, { enrolledCount: taken });
  return taken;
}

/** Active batches of a course that still have room, fullest-first. */
export async function findPlaceableBatches(studentCourseSlug) {
  const batches = await SchoolClass.find({ studentCourseSlug, status: 'active' }).sort({ createdAt: 1 }).lean();
  return batches
    .map((b) => {
      // A missing capacity falls back to the schema default rather than being
      // read as unlimited - an accidental omission must not uncap a batch.
      const capacity = Number.isFinite(b.capacity) && b.capacity > 0 ? b.capacity : 60;
      const remaining = capacity - (b.enrolledCount || 0);
      return { batch: b, capacity, remaining };
    })
    .filter((b) => b.remaining > 0)
    .sort((a, b) => a.remaining - b.remaining);
}

/**
 * Places one enrollment into a batch of its course, enforcing capacity.
 *
 * Idempotent on `enrollmentId`: a retried call returns the existing placement
 * instead of consuming a second seat. Returns null when no batch of the course
 * has room - a real business state (open another batch), not an error, and the
 * enrollment stays unplaced on the student side.
 */
export async function placeEnrollment({ studentCourseSlug, enrollmentId, studentName }) {
  if (!studentCourseSlug || !enrollmentId) return null;

  const already = await Student.findOne({ enrollmentId }).populate('class', 'code name').lean();
  if (already?.class) {
    return {
      batchId: String(already.class._id),
      batchCode: already.class.code,
      batchName: already.class.name,
      alreadyPlaced: true,
    };
  }

  for (const { batch } of await findPlaceableBatches(studentCourseSlug)) {
    const claimed = await claimSeat(batch._id);
    if (!claimed) continue; // filled between the read and the claim

    try {
      await Student.create({
        name: studentName || 'Enrolled student',
        // Placement happens at purchase time, before this service has been told
        // the student's real contact details; enrollment sync fills those in.
        // A per-enrollment placeholder satisfies the required-email and
        // unique-per-batch contracts until then.
        email: `${enrollmentId.toLowerCase()}@placement.pending`,
        class: batch._id,
        teacher: batch.teacher,
        enrollmentId,
        status: 'active',
      });
      return { batchId: String(batch._id), batchCode: batch.code, batchName: batch.name, alreadyPlaced: false };
    } catch (err) {
      await releaseSeat(batch._id);
      if (err?.code === 11000) continue; // a concurrent placement took this seat
      throw err;
    }
  }

  return null;
}

export default { placeEnrollment, findPlaceableBatches, recountBatchSeats };

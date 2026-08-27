import React, { useCallback, useEffect, useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { courseService } from '../../services/courseService';
import { useAuth } from '../../context/AuthContext';

/**
 * Real course reviews: the summary, the list, and (for students who actually
 * hold an enrollment) the form to leave or change their own rating.
 *
 * Everything here is backed by Review documents. A course nobody has reviewed
 * shows an honest empty state rather than the seeded 4.7-5.0 stars over
 * 1,200-3,200 imaginary reviews this replaces.
 */

function StarRow({ value, size = 'w-4 h-4' }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
        />
      ))}
    </span>
  );
}

function StarPicker({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg disabled:opacity-50 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
        >
          <Star
            className={`w-6 h-6 ${n <= shown ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function CourseReviews({ slug, isEnrolled }) {
  const { isAuthenticated } = useAuth();

  const [reviews, setReviews] = useState([]);
  const [meta, setMeta] = useState({ total: 0, rating: 0, reviewsCount: 0 });
  const [myReview, setMyReview] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const { reviews: list, meta: m } = await courseService.listCourseReviews(slug);
      setReviews(list);
      setMeta(m);
    } catch {
      // A failing reviews list must not take the whole course page down.
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isEnrolled || !isAuthenticated) {
      setMyReview(null);
      return;
    }
    courseService
      .getMyReview(slug)
      .then((mine) => {
        setMyReview(mine);
        if (mine) {
          setRating(mine.rating);
          setComment(mine.comment || '');
        }
      })
      .catch(() => setMyReview(null));
  }, [slug, isEnrolled, isAuthenticated]);

  const submit = async (e) => {
    e.preventDefault();
    if (rating < 1) {
      setError('Please choose a star rating first.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const payload = { rating, comment };
      const res = myReview
        ? await courseService.updateReview(slug, payload)
        : await courseService.createReview(slug, payload);
      setMyReview(res.review);
      setMeta((m) => ({ ...m, rating: res.course.rating, reviewsCount: res.course.reviewsCount }));
      setNotice(myReview ? 'Your review has been updated.' : 'Thanks for reviewing this course!');
      await load();
    } catch (err) {
      setError(err.message || 'Could not save your review. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Remove your review? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await courseService.deleteReview(slug);
      setMyReview(null);
      setRating(0);
      setComment('');
      setMeta((m) => ({ ...m, rating: res.course.rating, reviewsCount: res.course.reviewsCount }));
      setNotice('Your review has been removed.');
      await load();
    } catch (err) {
      setError(err.message || 'Could not remove your review. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const hasReviews = meta.reviewsCount > 0;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-white/10">
        <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight">
          Student Reviews
        </h2>
        {hasReviews ? (
          <div className="flex items-center gap-2.5">
            <StarRow value={meta.rating} size="w-5 h-5" />
            <span className="font-heading font-bold text-lg text-slate-900 dark:text-white">
              {meta.rating}
            </span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              from {meta.reviewsCount} {meta.reviewsCount === 1 ? 'review' : 'reviews'}
            </span>
          </div>
        ) : (
          <span className="text-sm text-slate-500 dark:text-slate-400">No reviews yet</span>
        )}
      </div>

      {/* Write / edit your own review - enrolled students only. The backend
          enforces this too; hiding the form is a convenience, not the gate. */}
      {isEnrolled && (
        <form
          onSubmit={submit}
          className="mb-8 p-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10"
        >
          <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white mb-3">
            {myReview ? 'Your review' : 'Rate this course'}
          </h3>

          <StarPicker value={rating} onChange={setRating} disabled={busy} />

          <label htmlFor="review-comment" className="block mt-4 mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
            Comment <span className="font-normal">(optional)</span>
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={busy}
            placeholder="What worked for you, and what would you tell a student considering this course?"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0D1424]/60 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-cyan-500"
          />

          {error && <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>}
          {notice && <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">{notice}</p>}

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {busy ? 'Saving…' : myReview ? 'Update review' : 'Submit review'}
            </button>

            {myReview && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full border border-slate-200 dark:border-white/15 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        </form>
      )}

      {!isEnrolled && (
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          Only students enrolled in this course can leave a review.
        </p>
      )}

      {hasReviews ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-heading font-bold text-sm text-slate-900 dark:text-white">{r.author}</span>
                <StarRow value={r.rating} />
              </div>
              {r.comment && (
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{r.comment}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Be the first to review this course once you have enrolled.
        </p>
      )}
    </section>
  );
}

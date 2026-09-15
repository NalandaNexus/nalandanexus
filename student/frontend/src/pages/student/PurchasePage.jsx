import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, Sparkles, BookOpen, Award, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudent } from '../../context/StudentContext';
import { courseService } from '../../services/courseService';
import { paymentService } from '../../services/paymentService';
import CouponField from '../../components/student/CouponField';

const COURSE_SLUG = 'prarambh';

const STATUS_LABEL = {
  'creating-order': 'Creating your order…',
  'awaiting-checkout': 'Opening secure Razorpay checkout…',
  'verifying-payment': 'Verifying your payment…',
  verified: 'Payment verified! Setting up your course…',
  'enrolled-free': 'Enrolling you…',
  'redeeming-coupon': 'Applying your coupon…',
};

export default function PurchasePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEnrolled, refreshData } = useStudent();

  const [course, setCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [statusKey, setStatusKey] = useState('');
  const [error, setError] = useState('');
  // The applied coupon is a PREVIEW from the backend, kept only to decide which
  // button to show and what figures to display. Nothing is spent until enrolment,
  // and the backend recomputes all of it then.
  const [coupon, setCoupon] = useState(null);

  useEffect(() => {
    let cancelled = false;
    courseService
      .getPublicCourse(COURSE_SLUG)
      .then((data) => {
        if (!cancelled) setCourse(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Unable to load course details.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Already purchased - no reason to see the paywall again.
  if (isEnrolled === true) {
    return <Navigate to="/student/dashboard" replace />;
  }

  const isFreeWithCoupon = Boolean(coupon?.isFree);

  /**
   * One button, two flows.
   *
   * A coupon that covers the whole price never reaches Razorpay - there is
   * nothing to charge, and a ₹0 order would be rejected by the gateway. Anything
   * else, including a partial discount, goes down the existing paid path exactly
   * as before. The backend makes this decision again on its own; this only
   * decides which request to send.
   */
  const handlePurchase = async () => {
    setIsPurchasing(true);
    setError('');
    try {
      let result;
      if (isFreeWithCoupon) {
        setStatusKey('redeeming-coupon');
        result = await paymentService.enrollWithCoupon({ courseSlug: COURSE_SLUG, code: coupon.code });
      } else {
        result = await paymentService.purchaseCourse({
          courseSlug: COURSE_SLUG,
          studentName: user?.name,
          studentEmail: user?.email,
          onStatus: setStatusKey,
        });
      }
      await refreshData();
      // Paid or free, a course is not opened before the student profile it
      // requires. The backend says which applies; it enforces it too.
      if (result?.studentProfile?.requiresCompletion) {
        navigate('/student/complete-profile', { replace: true, state: { from: '/student/dashboard' } });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    } catch (err) {
      // A coupon can lapse between preview and enrolment - somebody else may
      // have taken the last use. Drop it so the student sees the real price
      // again rather than a total that is no longer available.
      if (isFreeWithCoupon) setCoupon(null);
      setError(err.message || 'Payment could not be completed. Please try again.');
    } finally {
      setIsPurchasing(false);
      setStatusKey('');
    }
  };

  const priceLabel = course ? `₹${(course.priceInPaise / 100).toLocaleString('en-IN')}` : '₹5,000';
  const originalPriceLabel = course?.originalPriceInPaise ? `₹${(course.originalPriceInPaise / 100).toLocaleString('en-IN')}` : null;

  return (
    <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl bg-[#FAF9F4] border-2 border-[#DFDACB] rounded-3xl p-6 sm:p-10 shadow-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-[#AB5236]/10 text-[#AB5236] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-[#22355E]">
            One step left, {user?.name?.split(' ')[0] || 'Student'}
          </h1>
          <p className="text-sm text-[#2B2B28]/75 max-w-md mx-auto">
            Your Nalanda Nexus account is ready. Purchase the {course?.title || 'PRARAMBH — The Awakening'} course to
            unlock your student dashboard, lessons, tasks, quizzes, and leaderboard.
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-[#2B2B28]/60">Loading course details…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-white border border-[#DFDACB] flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-[#AB5236] shrink-0" />
                <span className="text-xs font-semibold text-[#22355E]">{course?.duration || '3 Months'}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-[#DFDACB] flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-[#22355E] shrink-0" />
                <span className="text-xs font-semibold text-[#22355E]">{course?.totalLessons ?? 13} lessons</span>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-[#DFDACB] flex items-center gap-2.5">
                <Award className="w-4 h-4 text-[#C99A2E] shrink-0" />
                <span className="text-xs font-semibold text-[#22355E]">Certificate on completion</span>
              </div>
            </div>

            <CouponField
              courseSlug={COURSE_SLUG}
              applied={coupon}
              onApplied={setCoupon}
              onRemoved={() => setCoupon(null)}
              disabled={isPurchasing}
            />

            <div className="p-5 rounded-2xl bg-white border border-[#DFDACB] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-data font-black text-3xl text-[#AB5236]">
                    {coupon ? `₹${(coupon.finalAmountInPaise / 100).toLocaleString('en-IN')}` : priceLabel}
                  </span>
                  {coupon ? (
                    <span className="font-data text-sm text-[#2B2B28]/50 line-through">{priceLabel}</span>
                  ) : (
                    originalPriceLabel && (
                      <span className="font-data text-sm text-[#2B2B28]/50 line-through">{originalPriceLabel}</span>
                    )
                  )}
                </div>
                <p className="text-[11px] text-[#2B2B28]/60 mt-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C99A2E]" />
                  {/* Naming Razorpay when nothing is being charged would be a lie,
                      and the checkout genuinely never opens on this path. */}
                  {isFreeWithCoupon ? 'No payment needed — your coupon covers this course' : 'Secure checkout powered by Razorpay'}
                </p>
              </div>

              <button
                type="button"
                onClick={handlePurchase}
                disabled={isPurchasing}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#AB5236] hover:bg-[#92422a] disabled:opacity-60 text-white font-heading font-bold text-sm rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 min-h-[48px]"
              >
                {isPurchasing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{STATUS_LABEL[statusKey] || 'Processing…'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isFreeWithCoupon ? 'Enroll for Free' : 'Purchase & Unlock Dashboard'}</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <p className="text-xs font-semibold text-[#AB5236] bg-[#AB5236]/10 border border-[#AB5236]/30 rounded-lg px-3 py-2.5 text-center">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

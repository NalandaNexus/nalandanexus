import React, { useState } from 'react';
import { Tag, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { paymentService } from '../../services/paymentService';

const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/**
 * Coupon entry on the purchase page.
 *
 * Applying a coupon only PREVIEWS it — nothing is spent until the student
 * actually enrols, so they can try a code, see the price, and change their mind.
 * The figures shown here come from the backend and are display-only; redemption
 * recomputes every one of them, so a stale preview or a tampered response cannot
 * change what is charged.
 *
 * The parent decides what the button does with `onApplied`. This component never
 * enrols anyone and never touches Razorpay.
 */
export default function CouponField({ courseSlug, applied, onApplied, onRemoved, disabled }) {
  const [code, setCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');

  const apply = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return setError('Enter your coupon code.');

    setIsChecking(true);
    setError('');
    try {
      const result = await paymentService.validateCoupon({ courseSlug, code: trimmed });
      onApplied(result);
      setCode('');
    } catch (err) {
      // The backend deliberately answers "Invalid coupon code." for unknown,
      // inactive and wrong-course alike; whatever it says is what the student
      // sees, so this surface cannot become a way to probe which codes exist.
      setError(err?.message || 'That coupon could not be applied.');
    } finally {
      setIsChecking(false);
    }
  };

  if (applied) {
    return (
      <div className="p-4 rounded-2xl bg-[#5C7A5E]/8 border border-[#5C7A5E]/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-[#5C7A5E] shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-heading font-bold text-[#22355E]">
                Coupon <span className="font-data">{applied.code}</span> applied
              </p>
              <p className="text-[11px] text-[#2B2B28]/60">
                {applied.isFree ? 'This course is now free for you.' : 'Discount applied to your total.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemoved}
            disabled={disabled}
            className="text-[11px] font-heading font-bold text-[#AB5236] hover:text-[#92422a] disabled:opacity-50 flex items-center gap-1 shrink-0"
          >
            <X className="w-3 h-3" /> Remove
          </button>
        </div>

        <dl className="mt-3 pt-3 border-t border-[#5C7A5E]/20 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <dt className="text-[#2B2B28]/70">Course price</dt>
            <dd className="font-data text-[#2B2B28]">{rupees(applied.originalAmountInPaise)}</dd>
          </div>
          <div className="flex items-center justify-between text-xs">
            <dt className="text-[#2B2B28]/70">Coupon discount</dt>
            <dd className="font-data text-[#5C7A5E]">− {rupees(applied.discountAmountInPaise)}</dd>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-[#5C7A5E]/20">
            <dt className="text-xs font-heading font-bold text-[#22355E]">Amount payable</dt>
            <dd className="font-data font-black text-lg text-[#22355E]">{rupees(applied.finalAmountInPaise)}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={apply} className="p-4 rounded-2xl bg-white border border-[#DFDACB]">
      <label htmlFor="coupon-code" className="flex items-center gap-1.5 text-xs font-heading font-bold text-[#22355E] mb-2">
        <Tag className="w-3.5 h-3.5 text-[#C99A2E]" /> Have a coupon?
      </label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError('');
          }}
          disabled={disabled || isChecking}
          placeholder="Enter coupon code"
          // Codes are issued uppercase; showing them that way as the student
          // types avoids a "why doesn't my code work" that is only casing.
          className="flex-1 min-w-0 bg-[#F7F5EE] border border-[#DFDACB] rounded-xl px-3.5 py-2.5 text-sm font-data uppercase tracking-wide text-[#22355E] placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-[#2B2B28]/40 focus:outline-none focus:border-[#22355E] disabled:opacity-60"
          autoComplete="off"
          spellCheck="false"
        />
        <button
          type="submit"
          disabled={disabled || isChecking || !code.trim()}
          className="px-5 py-2.5 rounded-xl bg-[#22355E] hover:bg-[#16233F] disabled:opacity-50 text-white font-heading font-bold text-xs transition-colors min-h-[44px] shrink-0"
        >
          {isChecking ? 'Checking…' : 'Apply'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[11px] text-[#C1352B] flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> {error}
        </p>
      )}
    </form>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStudent } from '../../context/StudentContext';
import { studentApiService } from '../../services/studentApiService';

/**
 * Complete Your Student Profile.
 *
 * Shown when a student holds a course - bought or given by a coupon - but has
 * not yet given the details a course requires. The backend decides whether the
 * profile is complete and refuses course content until it is; the checks on
 * this page only answer sooner, and say what is wrong beside the field it is
 * wrong in. The enrollment number is displayed, never editable, and never sent.
 */

const FALLBACK_CLASS_OPTIONS = Array.from({ length: 10 }, (_, i) => `Class ${i + 3}`);
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u;
const FIELDS = ['fullName', 'guardianName', 'grade', 'phone'];

const cleanName = (value) =>
  String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** The same rules as studentProfile.service.js#normalizePhone. The server's answer is the one that counts. */
function normalizePhone(raw) {
  const text = String(raw ?? '').trim();
  if (!text || !/^\+?[\d\s\-().]+$/.test(text)) return null;
  const digits = text.replace(/\D/g, '');
  const indianMobile = (national) => (/^[6-9]\d{9}$/.test(national) ? `+91${national}` : null);
  if (text.startsWith('+')) {
    if (digits.startsWith('91')) return indianMobile(digits.slice(2));
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.length === 10) return indianMobile(digits);
  if (digits.length === 11 && digits.startsWith('0')) return indianMobile(digits.slice(1));
  if (digits.length === 12 && digits.startsWith('91')) return indianMobile(digits.slice(2));
  return null;
}

function validate(values, classOptions) {
  const errors = {};
  const nameProblem = (value, required, invalid) => {
    const name = cleanName(value);
    if (!name) return required;
    if (name.length < 2 || name.length > 120 || !NAME_PATTERN.test(name)) return invalid;
    return null;
  };
  const fullName = nameProblem(values.fullName, 'Full name is required.', 'Please enter a valid full name.');
  const guardianName = nameProblem(values.guardianName, 'Parent/Guardian name is required.', 'Please enter a valid parent/guardian name.');
  if (fullName) errors.fullName = fullName;
  if (guardianName) errors.guardianName = guardianName;
  if (!classOptions.includes(values.grade)) errors.grade = 'Please select your class.';
  if (!normalizePhone(values.phone)) errors.phone = 'Please enter a valid phone number.';
  return errors;
}

/** A class saved before the list existed ("10th Standard") pre-selects its option, when it has one. */
function classOptionFor(grade, options) {
  if (options.includes(grade)) return grade;
  const match = /(\d{1,2})/.exec(String(grade || ''));
  const candidate = match ? `Class ${Number(match[1])}` : '';
  return options.includes(candidate) ? candidate : '';
}

/** An Indian number shown the way a student would type it. */
function phoneForInput(phone) {
  const match = /^\+91(\d{10})$/.exec(phone || '');
  return match ? `${match[1].slice(0, 5)} ${match[1].slice(5)}` : phone || '';
}

/** Only ever returns the student to somewhere inside their own workspace. */
function safeReturnPath(candidate) {
  const ok =
    typeof candidate === 'string' &&
    candidate.startsWith('/student/') &&
    !candidate.startsWith('/student/complete-profile') &&
    !candidate.includes('//');
  return ok ? candidate : '/student/dashboard';
}

const inputClass = (hasError) =>
  `w-full h-11 px-3.5 text-sm bg-white border rounded-xl text-[#2B2B28] placeholder-[#2B2B28]/40 focus:outline-none focus:ring-4 transition-all ${
    hasError ? 'border-[#AB5236] focus:ring-[#AB5236]/15' : 'border-[#DFDACB] focus:border-[#22355E] focus:ring-[#22355E]/10'
  }`;

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-[#22355E] mb-1.5">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[11px] font-semibold text-[#AB5236] mt-1">
          {error}
        </p>
      ) : (
        hint && <p className="text-[11px] text-[#2B2B28]/55 mt-1">{hint}</p>
      )}
    </div>
  );
}

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const { refreshData } = useStudent();
  const returnTo = safeReturnPath(location.state?.from || new URLSearchParams(location.search).get('next'));

  const [loadState, setLoadState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [completion, setCompletion] = useState(null);
  const [values, setValues] = useState({ fullName: '', guardianName: '', grade: '', phone: '' });
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const classOptions = completion?.classOptions?.length ? completion.classOptions : FALLBACK_CLASS_OPTIONS;

  useEffect(() => {
    let cancelled = false;
    studentApiService
      .getProfileCompletion()
      .then((data) => {
        if (cancelled) return;
        const options = data.classOptions?.length ? data.classOptions : FALLBACK_CLASS_OPTIONS;
        setCompletion(data);
        setValues({
          fullName: data.fields?.fullName || '',
          guardianName: data.fields?.guardianName || '',
          grade: classOptionFor(data.fields?.grade, options),
          phone: phoneForInput(data.fields?.phone),
        });
        setLoadState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message || 'Could not load your profile. Please try again.');
        setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clientErrors = useMemo(() => validate(values, classOptions), [values, classOptions]);
  const errorFor = (field) => serverErrors[field] || (touched[field] ? clientErrors[field] : undefined);
  const alreadyComplete = Boolean(completion?.complete) && !completion?.requiresCompletion;

  const change = (field) => (event) => {
    const { value } = event.target;
    setValues((prev) => ({ ...prev, [field]: value }));
    setServerErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError('');
  };
  const blur = (field) => () => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;

    setTouched(Object.fromEntries(FIELDS.map((f) => [f, true])));
    if (Object.keys(clientErrors).length) {
      setSubmitError('Please correct the highlighted fields.');
      return;
    }

    setIsSaving(true);
    setSubmitError('');
    setServerErrors({});
    try {
      const res = await studentApiService.completeProfile({
        fullName: cleanName(values.fullName),
        guardianName: cleanName(values.guardianName),
        grade: values.grade,
        phone: values.phone.trim(),
      });
      setCompletion(res.data);
      setSavedMessage(res.message || 'Profile saved.');
      // The name shown across the workspace comes from the account, and the
      // route gate reads the dashboard - both are refreshed before moving on,
      // so the student is not bounced straight back here.
      await Promise.allSettled([refreshUser?.(), refreshData?.()]);
      setTimeout(() => navigate(returnTo, { replace: true }), 900);
      // Left disabled: the student is on their way, and a second click must not resubmit.
    } catch (err) {
      const fieldErrors = {};
      for (const detail of err.details || []) {
        const field = String(detail.path || '').replace(/^body\./, '');
        if (FIELDS.includes(field)) fieldErrors[field] = detail.message;
      }
      setServerErrors(fieldErrors);
      setSubmitError(err.message || 'Could not save your profile. Please try again.');
      setIsSaving(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-[#22355E]/20 border-t-[#22355E] rounded-full animate-spin" aria-label="Loading your profile" />
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#FAF9F4] border-2 border-[#DFDACB] rounded-3xl p-8 text-center space-y-4">
          <p className="text-sm font-semibold text-[#22355E]">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-[#22355E] hover:bg-[#1A2A4A] text-white font-heading font-bold text-xs rounded-full"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EDEAE0] flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl bg-[#FAF9F4] border-2 border-[#DFDACB] rounded-3xl p-6 sm:p-10 shadow-lg space-y-6">
        {alreadyComplete && (
          <Link
            to={returnTo}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Link>
        )}

        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-[#22355E]/10 text-[#22355E] flex items-center justify-center mx-auto">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-[#22355E]">
            {alreadyComplete ? 'Your Student Profile' : 'Complete Your Student Profile'}
          </h1>
          <p className="text-sm text-[#2B2B28]/75 max-w-md mx-auto">
            {alreadyComplete
              ? 'Keep these details up to date. Your enrollment number never changes.'
              : 'Please provide the following information before continuing.'}
          </p>
        </div>

        {savedMessage && (
          <div role="status" className="flex items-center justify-center gap-2 text-xs font-semibold text-[#5C7A5E] bg-[#5C7A5E]/10 border border-[#5C7A5E]/30 rounded-lg px-3 py-2.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>{savedMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field id="fullName" label="Full Name" error={errorFor('fullName')}>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              maxLength={120}
              value={values.fullName}
              onChange={change('fullName')}
              onBlur={blur('fullName')}
              aria-invalid={Boolean(errorFor('fullName'))}
              aria-describedby={errorFor('fullName') ? 'fullName-error' : undefined}
              placeholder="Your full name"
              className={inputClass(errorFor('fullName'))}
            />
          </Field>

          <Field id="guardianName" label="Parent / Guardian Name" error={errorFor('guardianName')}>
            <input
              id="guardianName"
              type="text"
              maxLength={120}
              value={values.guardianName}
              onChange={change('guardianName')}
              onBlur={blur('guardianName')}
              aria-invalid={Boolean(errorFor('guardianName'))}
              aria-describedby={errorFor('guardianName') ? 'guardianName-error' : undefined}
              placeholder="Parent or guardian's full name"
              className={inputClass(errorFor('guardianName'))}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id="grade" label="Class" error={errorFor('grade')}>
              <select
                id="grade"
                value={values.grade}
                onChange={change('grade')}
                onBlur={blur('grade')}
                aria-invalid={Boolean(errorFor('grade'))}
                aria-describedby={errorFor('grade') ? 'grade-error' : undefined}
                className={inputClass(errorFor('grade'))}
              >
                <option value="">Select Class</option>
                {classOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="phone" label="Phone Number" error={errorFor('phone')} hint="10-digit mobile number, or include the country code.">
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={20}
                value={values.phone}
                onChange={change('phone')}
                onBlur={blur('phone')}
                aria-invalid={Boolean(errorFor('phone'))}
                aria-describedby={errorFor('phone') ? 'phone-error' : undefined}
                placeholder="98765 43210"
                className={inputClass(errorFor('phone'))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-white border border-[#DFDACB]">
              <p className="text-[10px] uppercase tracking-wider text-[#2B2B28]/50 flex items-center gap-1">
                <Lock className="w-3 h-3" aria-hidden="true" /> Enrollment Number
              </p>
              <p className="font-data font-bold text-base text-[#22355E] mt-0.5" aria-readonly="true">
                {completion?.enrollmentNumber || <span className="font-sans font-normal text-xs text-[#2B2B28]/55">Issued when you enrol in a course</span>}
              </p>
              <p className="text-[10px] text-[#2B2B28]/50">(System Generated)</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#DFDACB] min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[#2B2B28]/50 flex items-center gap-1">
                <Lock className="w-3 h-3" aria-hidden="true" /> Email
              </p>
              <p className="text-sm font-semibold text-[#22355E] mt-0.5 truncate">{completion?.fields?.email}</p>
              <p className="text-[10px] text-[#2B2B28]/50">(From your account)</p>
            </div>
          </div>

          {submitError && (
            <p role="alert" className="text-xs font-semibold text-[#AB5236] bg-[#AB5236]/10 border border-[#AB5236]/30 rounded-lg px-3 py-2.5 text-center">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full px-8 py-3.5 bg-[#AB5236] hover:bg-[#92422a] disabled:opacity-60 text-white font-heading font-bold text-sm rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 min-h-[48px]"
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{savedMessage ? 'Continuing…' : 'Saving…'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{alreadyComplete ? 'Save Changes' : 'Save & Continue'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

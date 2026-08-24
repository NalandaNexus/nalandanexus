import React, { useEffect, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/**
 * Renders Google's own "Sign in with Google" button via Google Identity
 * Services (loaded in index.html) and hands the resulting ID token up to
 * the caller. The backend independently verifies that token against
 * Google's public keys (see backend/src/services/auth.service.js
 * verifyGoogleIdToken) - this component never claims a user's identity on
 * its own, it only forwards what Google itself signed.
 *
 * A custom-styled button can't reliably trigger the One Tap / credential
 * flow across browsers per Google's own guidance, so we render their real
 * button (customized as close to our pill/rounded style as GIS allows)
 * rather than faking one - master doc section 49 (smallest clean change).
 */
export default function GoogleSignInButton({ text = 'signin_with', onCredential, onUnavailable }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;

    let cancelled = false;
    let attempts = 0;

    const tryRender = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        attempts += 1;
        if (attempts < 50) setTimeout(tryRender, 100);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => onCredential?.(response.credential),
      });

      if (containerRef.current) {
        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          width: 320,
        });
      }
    };

    tryRender();
    return () => {
      cancelled = true;
    };
  }, [text, onCredential]);

  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        onClick={onUnavailable}
        className="w-full h-11 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-100 font-heading font-semibold text-xs sm:text-sm rounded-full border border-slate-200 dark:border-slate-700 shadow-sm transition-all flex items-center justify-center gap-3"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.29 21.39 7.35 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.99 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.29 2.61 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
        </svg>
        <span>{text === 'signup_with' ? 'Sign up with Google' : 'Log in with Google'}</span>
      </button>
    );
  }

  return <div ref={containerRef} className="w-full flex justify-center [&>div]:!w-full" />;
}

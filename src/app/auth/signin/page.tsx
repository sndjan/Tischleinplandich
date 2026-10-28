'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import type { AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { safeNextPath } from '@/lib/auth/next-path';
import { StatusButton, useActionStatus } from '@/components/ui/status-button';
import { cn } from '@/lib/utils';

const RESEND_SECONDS = 30;
// Must match Authentication → Providers → Email → "Email OTP Length" in Supabase.
const CODE_LENGTH = 8;

const authErrorMessage = (error: AuthError) => {
  if (error.status === 429) return 'Zu viele Versuche. Bitte kurz warten.';
  if (/expired|invalid/i.test(error.message)) return 'Code falsch oder abgelaufen';
  if (/email/i.test(error.message) && /valid/i.test(error.message)) return 'Bitte eine gültige E-Mail eingeben';
  return 'Das hat nicht geklappt. Bitte erneut versuchen.';
};

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const linkFailed = searchParams.get('error') === 'link';

  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(
    linkFailed ? 'Der Link hat nicht funktioniert. Fordere einen neuen an oder gib den Code ein.' : null,
  );
  const [resendIn, setResendIn] = useState(0);
  const sendStatus = useActionStatus();
  const verifyStatus = useActionStatus();
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  const sendLink = () =>
    sendStatus.run(async () => {
      setError(null);
      const callback = new URL('/auth/callback', window.location.origin);
      if (next !== '/meal-planner') callback.searchParams.set('next', next);

      const { error: sendError } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true, emailRedirectTo: callback.toString() },
      });

      if (sendError) {
        setError(authErrorMessage(sendError));
        throw sendError;
      }

      setCode('');
      setStep('code');
      setResendIn(RESEND_SECONDS);
    }).catch(() => undefined);

  const verifyCode = (token: string) =>
    verifyStatus.run(async () => {
      setError(null);
      const { error: verifyError } = await createClient().auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'email',
      });

      if (verifyError) {
        setError(authErrorMessage(verifyError));
        throw verifyError;
      }

      router.replace(next);
      router.refresh();
    }).catch(() => undefined);

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH && verifyStatus.status === 'idle') void verifyCode(digits);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-brand-accent-bg to-brand-app-bg to-45% px-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        {step === 'code' && (
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setError(null);
            }}
            className="mt-3 -ml-3 flex size-11 items-center justify-center rounded-full bg-white/80 transition-transform active:scale-95"
            aria-label="Andere E-Mail verwenden"
          >
            <ArrowLeft className="size-5 text-brand-ink" />
          </button>
        )}

        <section className={cn('flex flex-col items-center gap-2.5 text-center', step === 'code' ? 'pt-12' : 'pt-24')}>
          <span className="flex size-[88px] items-center justify-center rounded-[26px] bg-white text-5xl shadow-[0_10px_24px_rgba(47,122,82,0.18)]" aria-hidden="true">
            {step === 'code' ? '📬' : '🥗'}
          </span>
          <h1 className="mt-2 font-heading text-[28px] font-extrabold leading-tight text-brand-ink">
            {step === 'code' ? 'Schau in dein Postfach' : 'Willkommen'}
          </h1>
          <p className="text-[15px] leading-relaxed text-brand-secondary">
            {step === 'code' ? (
              <>
                Wir haben einen Link an
                <br />
                <b className="text-brand-ink">{email.trim()}</b> geschickt.
              </>
            ) : (
              <>
                Plane deine Woche, die Einkaufsliste
                <br />
                schreibt sich von selbst.
              </>
            )}
          </p>
        </section>

        {step === 'email' ? (
          <form
            className="mt-10 flex flex-col gap-3.5"
            onSubmit={(event) => {
              event.preventDefault();
              void sendLink();
            }}
          >
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-brand-ink">
              E-Mail
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="du@beispiel.de"
                className="h-[52px] rounded-[14px] border border-brand-input-border bg-white px-3.5 text-base font-normal text-brand-ink outline-none transition-colors focus:border-2 focus:border-brand-accent"
              />
            </label>
            {error && <p role="alert" className="text-sm font-medium text-brand-red">{error}</p>}
            <StatusButton
              type="submit"
              status={sendStatus.status}
              pendingLabel="Wird gesendet …"
              successLabel="Gesendet"
              className="mt-1 h-[54px] w-full rounded-[14px] text-base font-bold"
            >
              <Mail className="size-[18px]" />
              Anmeldelink senden
            </StatusButton>
            <p className="text-center text-[13px] leading-relaxed text-brand-secondary">
              Kein Passwort nötig. Neu hier? Mit demselben Knopf wird dein Konto angelegt. Es gilt unsere{' '}
              <Link href="/datenschutz" className="underline hover:text-brand-ink">
                Datenschutzerklärung
              </Link>
              .
            </p>
          </form>
        ) : (
          <section className="mt-9 flex flex-col gap-3">
            <label htmlFor="otp" className="text-center text-[13px] font-bold text-brand-ink">
              Oder den Code aus der Mail eingeben
            </label>
            <input
              id="otp"
              ref={codeInputRef}
              value={code}
              onChange={(event) => handleCodeChange(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={'·'.repeat(CODE_LENGTH)}
              aria-invalid={Boolean(error)}
              className={cn(
                'h-16 rounded-2xl border bg-white text-center font-heading text-[30px] font-extrabold tracking-[0.45em] text-brand-ink outline-none transition-colors placeholder:text-brand-icon-muted focus:border-2 focus:border-brand-accent',
                error ? 'border-brand-red' : 'border-brand-input-border',
              )}
            />
            {error && <p role="alert" className="text-center text-sm font-medium text-brand-red">{error}</p>}
            {code.length >= CODE_LENGTH ? (
              <StatusButton
                type="button"
                status={verifyStatus.status}
                pendingLabel="Prüft …"
                successLabel="Angemeldet"
                onClick={() => void verifyCode(code)}
                className="h-[54px] w-full rounded-[14px] text-base font-bold"
              >
                Anmelden
              </StatusButton>
            ) : (
              <p className="text-center text-[13px] leading-relaxed text-brand-secondary">
                Praktisch, wenn die App auf dem Homescreen liegt: der Link öffnet sonst den Browser.
              </p>
            )}
          </section>
        )}

        {step === 'code' && (
          <div className="mt-auto flex justify-center pt-8">
            <button
              type="button"
              disabled={resendIn > 0 || sendStatus.status === 'pending'}
              onClick={() => void sendLink()}
              className="h-11 px-3 text-sm font-semibold text-brand-accent-dark transition-transform active:scale-95 disabled:text-brand-muted"
            >
              {resendIn > 0 ? `Erneut senden in 0:${String(resendIn).padStart(2, '0')}` : 'Erneut senden'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

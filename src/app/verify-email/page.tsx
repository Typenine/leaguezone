'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import Button from '@/components/ui/Button';

function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams?.get('next') || null);
  const initialDeliveryFailed = searchParams?.get('delivery') === 'failed';

  const [email, setEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(
    initialDeliveryFailed
      ? 'Your account was created, but we could not send the first verification email. Try sending it again below.'
      : null,
  );

  useEffect(() => {
    const pendingEmail = window.sessionStorage.getItem('pendingVerificationEmail');
    if (pendingEmail) setEmail(pendingEmail);
  }, []);

  async function handleResend() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setResendError('Enter the email address you used to create your account.');
      return;
    }

    setResendLoading(true);
    setResendMessage(null);
    setResendError(null);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, next: nextPath || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Verification email could not be sent.');
      }

      window.sessionStorage.setItem('pendingVerificationEmail', normalizedEmail);
      setResendMessage(
        'If an unverified LeagueZone account exists for that email, a new verification message has been sent.',
      );
    } catch (e) {
      setResendError(e instanceof Error ? e.message : 'Verification email could not be sent.');
    } finally {
      setResendLoading(false);
    }
  }

  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
  const inputCls = 'w-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-[var(--text)] focus:outline-none focus:border-[var(--brand-gold)]/60 focus:ring-1 focus:ring-[var(--brand-gold)]/30 transition-colors';

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" aria-label="Website home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/LeagueZone HQ Logo.png" alt="LeagueZone HQ" className="w-20 h-20 object-contain" />
          </Link>
        </div>

        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Verify Email</span>
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
        </div>
        <h1 className="text-3xl font-black text-center text-white uppercase tracking-tight mb-2">Check your inbox</h1>
        <p className="text-center text-sm text-white/45 mb-8">
          Verify your email address before signing in to LeagueZone.
        </p>

        <Card style={{ background: '#0d1422' }}>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-3 text-sm text-white/60">
              <p>We sent a verification link that expires in 24 hours.</p>
              <p>Click the link in the email, then sign in to continue.</p>
            </div>

            <div>
              <Label htmlFor="verification-email" className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">
                Email
              </Label>
              <input
                id="verification-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleResend()}
                className={inputCls}
              />
            </div>

            {resendError && (
              <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-2" role="alert">
                {resendError}
              </div>
            )}

            {resendMessage && (
              <div className="text-sm text-green-400 border border-green-500/30 bg-green-500/10 px-3 py-2" role="status">
                {resendMessage}
              </div>
            )}

            <Button
              onClick={handleResend}
              disabled={resendLoading || !email.trim()}
              variant="secondary"
              className="w-full"
            >
              {resendLoading ? 'Sending…' : 'Resend verification email'}
            </Button>

            <p className="text-center text-xs text-white/35">
              Didn&apos;t receive it? Check your spam folder, confirm the address above, then resend.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-white/45 mt-6">
          <Link href={loginHref} className="text-[var(--brand-gold)] hover:underline font-bold">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

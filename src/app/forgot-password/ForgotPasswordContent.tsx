'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import Label from '@/components/ui/Label';
import Button from '@/components/ui/Button';

export default function ForgotPasswordContent() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email) return;
    try {
      setLoading(true);
      setError(null);
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      // Always show success — don't leak whether the email exists
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" aria-label="Website home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/LeagueZone HQ Logo.png"
              alt="LeagueZone HQ"
              className="w-20 h-20 object-contain"
            />
          </Link>
        </div>

        <div className="flex items-center justify-center gap-3 mb-3">
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">Reset Password</span>
          <span className="block w-6 h-px bg-[var(--brand-gold)]" />
        </div>
        <h1 className="text-3xl font-black text-center text-white uppercase tracking-tight mb-2">Forgot password?</h1>
        <p className="text-center text-sm text-white/45 mb-8">
          Enter your email and we&apos;ll send a reset link.
        </p>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {submitted ? (
              <div className="text-center space-y-4 py-4">
                <div className="text-4xl">📧</div>
                <p className="text-white font-black uppercase tracking-wide text-sm">Check your email</p>
                <p className="text-sm text-white/50">
                  If an account exists for <strong className="text-white">{email}</strong>, we&apos;ve sent a reset link.
                  It expires in 1 hour.
                </p>
                <Link href="/login" className="text-[var(--brand-gold)] hover:underline text-sm font-bold">
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="email" className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">Email address</Label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    className="w-full border border-[var(--border)] bg-[var(--surface-strong)] px-3 py-2.5 text-[var(--text)] focus:outline-none focus:border-[var(--brand-gold)]/60 focus:ring-1 focus:ring-[var(--brand-gold)]/30 transition-colors"
                  />
                </div>

                {error && <div className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-2" role="alert">{error}</div>}

                <Button
                  onClick={handleSubmit}
                  disabled={!email || loading}
                  variant="primary"
                  className="w-full"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </Button>

                <p className="text-center text-sm">
                  <Link href="/login" className="text-[var(--brand-gold)] hover:underline font-bold">
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

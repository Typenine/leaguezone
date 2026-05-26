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
    <div className="container mx-auto px-4 py-10 max-w-md">
      <div className="flex justify-center mb-6">
        <Link href="/" aria-label="Website home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/teams/East v West Logos/EvW Clancy logo.png"
            alt="League logo"
            className="w-16 h-16 object-contain"
          />
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-center text-[var(--text)] mb-2">Forgot password?</h1>
      <p className="text-center text-sm text-[var(--muted)] mb-6">
        Enter your email and we&apos;ll send a reset link.
      </p>

      <Card>
        <CardContent className="pt-6 space-y-5">
          {submitted ? (
            <div className="text-center space-y-4 py-4">
              <div className="text-4xl">📧</div>
              <p className="text-[var(--text)] font-medium">Check your email</p>
              <p className="text-sm text-[var(--muted)]">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a reset link.
                It expires in 1 hour.
              </p>
              <Link href="/login" className="text-[var(--accent)] hover:underline text-sm">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="email" className="mb-2 block">Email address</Label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
                />
              </div>

              {error && <div className="text-sm text-red-500" role="alert">{error}</div>}

              <Button
                onClick={handleSubmit}
                disabled={!email || loading}
                variant="primary"
                className="w-full"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>

              <p className="text-center text-sm text-[var(--muted)]">
                <Link href="/login" className="text-[var(--accent)] hover:underline">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

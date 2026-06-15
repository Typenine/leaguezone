'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const next = searchParams?.get('next') || '/home';
  
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data?.user?.emailVerified) {
            setVerified(true);
          }
          if (data?.user?.email) {
            setEmail(data.user.email);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  async function handleResend() {
    setResendLoading(true);
    setResendMessage(null);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setResendMessage('Verification email sent! Check your inbox.');
      } else {
        setResendMessage('Failed to send email. Please try again.');
      }
    } catch {
      setResendMessage('Failed to send email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <div className="text-4xl mb-4">📧</div>
        <p className="text-[var(--muted)]">Checking verification status...</p>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="container mx-auto px-4 py-20 max-w-md text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-4">Email Verified!</h1>
        <p className="text-[var(--muted)] mb-6">
          Your email has been verified. You can now access all league features.
        </p>
        <Link
          href={next}
          className="inline-flex items-center px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:opacity-90"
        >
          Continue →
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-20 max-w-md">
      <div className="text-center mb-8">
        <div className="text-4xl mb-4">📧</div>
        <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Verify Your Email</h1>
        <p className="text-[var(--muted)]">
          Please verify your email address to access league features.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="bg-[var(--surface-strong)] rounded-lg p-4 text-center">
            <p className="text-sm text-[var(--muted)] mb-1">Verification sent to:</p>
            <p className="font-medium text-[var(--text)]">{email || 'your email address'}</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-[var(--text)]">
              <strong>Next steps:</strong>
            </p>
            <ol className="text-sm text-[var(--muted)] space-y-2 list-decimal list-inside">
              <li>Check your inbox for the verification email</li>
              <li>Click the verification link in the email</li>
              <li>Return here to continue</li>
            </ol>
          </div>

          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-sm text-[var(--muted)] mb-3">
              Didn&apos;t receive the email? Check your spam folder or resend it.
            </p>
            <Button
              onClick={handleResend}
              disabled={resendLoading}
              variant="secondary"
              className="w-full"
            >
              {resendLoading ? 'Sending...' : 'Resend Verification Email'}
            </Button>
            {resendMessage && (
              <p className={`text-sm mt-2 text-center ${resendMessage.includes('sent') ? 'text-green-500' : 'text-red-500'}`}>
                {resendMessage}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-[var(--muted)] mt-6">
        <Link href="/login" className="text-[var(--accent)] hover:underline">
          ← Back to login
        </Link>
      </p>
    </div>
  );
}

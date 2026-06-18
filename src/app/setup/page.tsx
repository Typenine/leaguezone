'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

type SetupStep = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
};

const SETUP_STEPS: SetupStep[] = [
  { id: 'league', title: 'League Identity', description: 'Name your league and set basic info', completed: false },
  { id: 'sleeper', title: 'Sleeper Integration', description: 'Connect your Sleeper league', completed: false },
  { id: 'branding', title: 'Branding', description: 'Set colors and upload logo', completed: false },
  { id: 'teams', title: 'Team Colors', description: 'Customize team colors (optional)', completed: false },
  { id: 'rules', title: 'Rules', description: 'Add league rules (optional)', completed: false },
  { id: 'admin', title: 'Admin Account', description: 'Create your admin login', completed: false },
  { id: 'auth', title: 'Team Signup', description: 'Configure how teams join', completed: false },
];

export default function SetupPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<SetupStep[]>(SETUP_STEPS);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if setup is already completed
    async function checkSetup() {
      // Read directly from window.location so the value is always current on the client
      const isNewLeague = new URLSearchParams(window.location.search).get('new') === '1';

      try {
        const [statusRes, meRes] = await Promise.all([
          fetch('/api/setup/status'),
          fetch('/api/auth/me').catch(() => null),
        ]);

        if (statusRes.ok) {
          const data = await statusRes.json();
          // Allow site admins to start a new league even if one is already set up
          const meData = meRes ? await meRes.json().catch(() => ({})) : {};
          if (data.setupCompleted && !(isNewLeague && meData.isSiteAdmin)) {
            router.push('/');
            return;
          }

          // When starting a new league, always begin with empty steps
          let completedSteps: string[] = isNewLeague ? [] : (data.completedSteps || []);

          // If already signed in as admin, auto-skip the admin account creation step
          if (meData.isAdmin && !completedSteps.includes('admin')) {
            try {
              const skipRes = await fetch('/api/setup/admin');
              if (skipRes.ok) {
                completedSteps = [...completedSteps, 'admin'];
              }
            } catch {
              // Non-fatal: step will be skipped when navigated to directly
            }
          }

          // Update steps based on saved progress
          setSteps(prev => prev.map(step => ({
            ...step,
            completed: completedSteps.includes(step.id)
          })));
          // Find first incomplete step
          const firstIncomplete = SETUP_STEPS.findIndex(
            s => !completedSteps.includes(s.id)
          );
          setCurrentStep(firstIncomplete >= 0 ? firstIncomplete : 0);
        }
      } catch {
        // API not ready yet, show setup
      }
      setLoading(false);
    }
    checkSetup();
  }, [router]);

  const handleStepClick = (index: number) => {
    // Can only go to completed steps or next incomplete step
    const canNavigate = index <= currentStep || steps[index - 1]?.completed;
    if (canNavigate) {
      router.push(`/setup/${steps[index].id}`);
    }
  };

  const handleStart = () => {
    router.push(`/setup/${steps[currentStep].id}`);
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--brand-gold)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="block w-6 h-px bg-[var(--brand-gold)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-[var(--brand-gold)]">League Setup</span>
            <span className="block w-6 h-px bg-[var(--brand-gold)]" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white mb-2">
            Welcome to Your Fantasy League
          </h1>
          <p className="text-white/50">
            Let&apos;s set up your league website in a few easy steps.
          </p>
        </div>

        <Card className="p-6">
          <div className="space-y-2">
            {steps.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = step.completed;
              const isLocked = index > currentStep && !steps[index - 1]?.completed;

              return (
                <button
                  key={step.id}
                  onClick={() => handleStepClick(index)}
                  disabled={isLocked}
                  className={`w-full text-left p-4 border transition-all ${
                    isActive
                      ? 'border-[var(--brand-gold)] bg-[var(--brand-gold)]/8'
                      : isCompleted
                      ? 'border-green-500/30 bg-green-500/5'
                      : isLocked
                      ? 'border-[var(--border)] opacity-40 cursor-not-allowed'
                      : 'border-[var(--border)] hover:border-[var(--brand-gold)]/40'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 flex items-center justify-center text-xs font-black ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-[var(--brand-gold)] text-[var(--brand-ink)]'
                          : 'bg-[var(--surface-strong)] text-[var(--muted)]'
                      }`}
                    >
                      {isCompleted ? '✓' : index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-black uppercase tracking-wide text-sm text-[var(--text)]">{step.title}</div>
                      <div className="text-xs text-[var(--muted)] mt-0.5">{step.description}</div>
                    </div>
                    {isActive && (
                      <svg
                        className="w-4 h-4 text-[var(--brand-gold)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <Button onClick={handleStart} className="w-full">
              {currentStep === 0 ? 'Get Started' : 'Continue Setup'}
            </Button>
          </div>
        </Card>

        <p className="text-center text-xs text-white/25 mt-6">
          You can always change these settings later in the admin panel.
        </p>
      </div>
    </div>
  );
}

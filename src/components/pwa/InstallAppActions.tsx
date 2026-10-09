'use client';

import { useEffect, useRef, useState } from 'react';

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform: string };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

type InstallState = 'checking' | 'ready' | 'manual' | 'installed';

function standalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export default function InstallAppActions() {
  const [state, setState] = useState<InstallState>('checking');
  const [device, setDevice] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    setDevice(/iphone|ipad|ipod/.test(ua) ? 'ios' : /android/.test(ua) ? 'android' : 'desktop');
    if (standalone()) {
      setState('installed');
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;
      setState('ready');
    };
    const onInstalled = () => {
      promptRef.current = null;
      setState('installed');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const timer = window.setTimeout(() => setState((current) => current === 'checking' ? 'manual' : current), 1800);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    const pending = promptRef.current;
    if (!pending) return;
    promptRef.current = null;
    try {
      await pending.prompt();
      const choice = await pending.userChoice;
      setState(choice.outcome === 'accepted' ? 'installed' : 'manual');
    } catch {
      setState('manual');
    }
  };

  return (
    <div className="rounded-xl border border-[var(--brand-gold)]/30 bg-white/[0.045] p-6 sm:p-8" aria-live="polite">
      <h2 className="text-2xl font-black uppercase tracking-tight text-white">Install LeagueZone</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">
        No app store or separate account is needed. Installation adds LeagueZone to your home screen or app launcher.
      </p>
      {state === 'installed' ? (
        <p className="mt-6 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
          LeagueZone is running in its installed app window.
        </p>
      ) : (
        <>
          {state === 'ready' && (
            <button
              type="button"
              onClick={() => void install()}
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-[var(--brand-gold)] px-6 py-3 text-sm font-black uppercase tracking-wider text-[var(--brand-ink)] hover:brightness-110"
            >
              Install LeagueZone
            </button>
          )}
          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-sm font-black uppercase tracking-wider text-[var(--brand-gold)]">
              {device === 'ios' ? 'On iPhone or iPad' : device === 'android' ? 'On Android' : 'On your computer'}
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
              {device === 'ios'
                ? 'Open this page in your browser, tap Share, then choose Add to Home Screen. Confirm Add to create the LeagueZone app.'
                : device === 'android'
                  ? 'In Chrome, open the browser menu (three dots), choose Install app or Add to Home screen, then confirm.'
                  : 'In Chrome or Edge, open the browser menu and choose Install LeagueZone or Install this site as an app. On Safari for Mac, use File, then Add to Dock.'}
            </p>
            {state === 'checking' && <p className="mt-3 text-xs text-white/40">Checking whether your browser offers one-tap installation…</p>}
          </div>
        </>
      )}
    </div>
  );
}

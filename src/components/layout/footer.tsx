import Link from 'next/link';
import { CURRENT_YEAR } from '@/lib/constants/league';
import { PLATFORM } from '@/lib/config/platform';

export default function Footer() {
  return (
    <footer style={{ background: 'var(--brand-navy)' }} className="border-t border-white/10 py-8 mt-auto" role="contentinfo" aria-label="Site footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-sm text-white/45">
            <p className="font-black text-[var(--brand-gold)] uppercase tracking-wider text-xs">{PLATFORM.name}</p>
            <p className="mt-1">© {CURRENT_YEAR} {PLATFORM.name}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold uppercase tracking-wider text-white/40">
            <Link href="/" className="hover:text-[var(--brand-gold)] transition-colors">Home</Link>
            <Link href="/features" className="hover:text-[var(--brand-gold)] transition-colors">Features</Link>
            <Link href="/pricing" className="hover:text-[var(--brand-gold)] transition-colors">Pricing</Link>
            <Link href="/demo" className="hover:text-[var(--brand-gold)] transition-colors">Demo</Link>
            <Link href="/app" className="hover:text-[var(--brand-gold)] transition-colors">My Leagues</Link>
            <a href={`mailto:${PLATFORM.contactEmail}`} className="hover:text-[var(--brand-gold)] transition-colors">Contact</a>
          </nav>
        </div>
        <p className="mt-6 border-t border-white/10 pt-4 text-xs leading-5 text-white/25">
          {PLATFORM.disclaimer}
        </p>
      </div>
    </footer>
  );
}

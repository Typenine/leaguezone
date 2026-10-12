'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Notify the shared app companion when Next changes routes without a reload. */
export default function CompanionLifecycle() {
  const pathname = usePathname();
  useEffect(() => {
    window.dispatchEvent(new Event('leaguezone:navigated'));
  }, [pathname]);
  return null;
}

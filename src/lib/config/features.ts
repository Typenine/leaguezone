export const PLATFORM_FEATURES = {
  newsletter: process.env.NEXT_PUBLIC_NEWSLETTER_ENABLED === 'true',
} as const;

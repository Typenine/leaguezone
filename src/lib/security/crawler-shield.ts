const AUTOMATED_CLIENT_PATTERN =
  /(?:bot|crawler|spider|slurp|preview|headless|lighthouse|facebookexternalhit|twitterbot|linkedinbot|discordbot|slackbot|whatsapp|telegrambot|redditbot|google-inspectiontool|adsbot|googleother|ahrefs|semrush|mj12|petalbot|bytespider|gptbot|chatgpt-user|claudebot|claude-web|perplexitybot|amazonbot|applebot|duckduckbot|yandexbot|baiduspider|siteaudit|curl\/|wget\/|python-requests|python\/|go-http-client|axios\/|node-fetch|postmanruntime|okhttp\/|java\/)/i;

/**
 * Public league pages are expensive because they resolve league/provider data.
 * Anonymous automated clients should never wake Postgres just to crawl them.
 *
 * An empty User-Agent is treated as automated because normal supported browsers
 * always send one, while scanners frequently omit it.
 */
export function isAutomatedPublicClient(userAgent: string | null | undefined): boolean {
  const value = userAgent?.trim() || '';
  if (!value) return true;
  return AUTOMATED_CLIENT_PATTERN.test(value);
}

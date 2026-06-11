export function NewsletterProseStyles() {
  return (
    <style jsx global>{`
      .newsletter-prose h1 { font-size: 1.75rem; font-weight: 700; margin: 1.5rem 0 0.75rem; color: var(--text); }
      .newsletter-prose h2 { font-size: 1.4rem; font-weight: 700; margin: 1.25rem 0 0.6rem; color: var(--text); }
      .newsletter-prose h3 { font-size: 1.15rem; font-weight: 600; margin: 1rem 0 0.5rem; color: var(--text); }
      .newsletter-prose p { margin-bottom: 0.85rem; line-height: 1.7; color: var(--text); }
      .newsletter-prose p strong, .newsletter-prose li strong { color: var(--text); font-weight: 600; }
      .newsletter-prose ul { margin: 0.5rem 0 1rem 1.5rem; list-style-type: disc; }
      .newsletter-prose ol { margin: 0.5rem 0 1rem 1.5rem; list-style-type: decimal; }
      .newsletter-prose li { margin-bottom: 0.45rem; line-height: 1.65; }
      .newsletter-prose blockquote {
        border-left: 3px solid var(--accent);
        padding: 0.5rem 0 0.5rem 1rem;
        margin: 1rem 0;
        color: var(--muted);
        font-style: italic;
      }
      .newsletter-prose a { color: var(--accent); text-decoration: underline; }
      .newsletter-prose img { max-width: 100%; height: auto; border-radius: 10px; margin: 1rem 0; }
      .newsletter-prose table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.95rem; }
      .newsletter-prose th, .newsletter-prose td { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }
      .newsletter-prose th { background: color-mix(in srgb, var(--surface-strong) 80%, transparent); font-weight: 600; }
      .newsletter-prose hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
      .newsletter-prose pre, .newsletter-prose code {
        font-family: ui-monospace, monospace;
        font-size: 0.9em;
        background: color-mix(in srgb, var(--surface-strong) 60%, transparent);
        border-radius: 4px;
      }
      .newsletter-prose pre { padding: 1rem; overflow-x: auto; margin: 1rem 0; }
      .newsletter-prose code { padding: 0.15rem 0.35rem; }
    `}</style>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "League Setup",
  description: "Set up your fantasy football league",
};

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Setup pages use a minimal layout without the main navbar/footer
  return (
    <div style={{ background: 'var(--brand-ink)' }} className="min-h-screen">
      {children}
    </div>
  );
}

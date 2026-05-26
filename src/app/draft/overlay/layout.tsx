import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Draft Overlay",
  description: "Live draft overlay display",
};

export default function OverlayLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This layout bypasses the main site layout (no navbar/footer)
  return <>{children}</>;
}

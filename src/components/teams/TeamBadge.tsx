"use client";

import { TeamLogo } from "@/components/ui/TeamLogo";
import { useTeamBranding } from "@/contexts/TeamLogoContext";
import { getTeamColors } from "@/lib/utils/team-utils";
import { cn } from "@/lib/utils/cn";

export default function TeamBadge({
  team,
  size = "md",
  showName = true,
  className,
}: {
  team: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}) {
  const px = size === "lg" ? 40 : size === "md" ? 28 : 20;
  const branding = useTeamBranding()[team];
  const fallback = getTeamColors(team);
  const primary = branding?.primaryColor || fallback.primary;
  const secondary = branding?.secondaryColor || fallback.secondary;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="flex items-center justify-center rounded-full overflow-hidden border"
        style={{ width: px, height: px, borderColor: secondary, backgroundColor: primary }}
      >
        <TeamLogo teamName={team} size={px} />
      </div>
      {showName && (
        <span
          className="truncate max-w-[14rem] px-2 py-0.5 rounded text-[var(--text)]"
          style={{ backgroundColor: `${secondary}22` }}
        >
          {team}
        </span>
      )}
    </div>
  );
}

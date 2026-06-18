import Card, { CardContent, CardHeader, CardTitle } from "./Card";

export function StatCard({
  label,
  value,
  delta,
  positive,
  icon,
  className,
}: {
  label: string;
  value: string | number;
  delta?: string;
  positive?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--brand-gold)]">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-black text-[var(--text)]">{value}</div>
        {delta && (
          <div
            className={[
              "mt-1 text-sm",
              positive === true ? "text-emerald-400" : undefined,
              positive === false ? "text-red-400" : undefined,
              positive === undefined ? "text-[var(--muted)]" : undefined,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {delta}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StatCard;

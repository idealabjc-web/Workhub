import { LucideIcon } from "lucide-react";

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-${accent}-100 text-${accent}-600 dark:bg-${accent}-900 dark:text-${accent}-300`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

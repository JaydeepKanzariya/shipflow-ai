import { statusMeta } from "@/lib/pipeline";

/**
 * Status pill coloured by its pipeline stage — the colour tells you where the
 * feature is in the delivery loop. Mono-cased to read as a data chip.
 */
export function StatusBadge({ status }: { status: string }) {
  const { label, colorVar } = statusMeta(status);
  const color = `var(${colorVar})`;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{
        color,
        borderColor: `color-mix(in oklch, ${color} 35%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import {
  ACCENTS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  applyAccent,
  findAccent,
} from "@/lib/themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

// A tiny external store over the persisted accent — hydration-safe and
// rule-compliant (no setState in an effect). Local changes notify listeners so
// the picker re-renders immediately.
const listeners = new Set<() => void>();
function subscribeAccent(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function accentSnapshot() {
  return localStorage.getItem(ACCENT_STORAGE_KEY) ?? DEFAULT_ACCENT;
}
function setAccent(id: string) {
  localStorage.setItem(ACCENT_STORAGE_KEY, id);
  applyAccent(findAccent(id));
  listeners.forEach((l) => l());
}

/** false during SSR, true after mount — no setState, no hydration mismatch. */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function Appearance() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const accentId = useSyncExternalStore(
    subscribeAccent,
    accentSnapshot,
    () => DEFAULT_ACCENT,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="size-4" /> Appearance
        </CardTitle>
        <CardDescription>
          Make ShipFlow yours. Choose a mode and an accent — applied instantly.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode */}
        <div className="space-y-2">
          <p className="eyebrow">Mode</p>
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
            {MODES.map((m) => {
              const active = mounted && theme === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setTheme(m.value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <m.icon className="size-4" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent */}
        <div className="space-y-3">
          <p className="eyebrow">Accent</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {ACCENTS.map((a) => {
              const selected = mounted && accentId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  className={cn(
                    "group flex flex-col items-center gap-2 rounded-xl border p-3 transition-all",
                    selected ? "border-transparent" : "border-border hover:border-border/80",
                  )}
                  style={selected ? { boxShadow: `0 0 0 2px ${a.primary}` } : undefined}
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-full shadow-sm"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${a.primary}, ${a.brandAccent})`,
                    }}
                  >
                    {selected && <Check className="size-4 text-white drop-shadow" />}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                    {a.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  GitPullRequest,
  Inbox,
  KanbanSquare,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: Inbox, title: "Request", desc: "A feature request comes in from any channel." },
  { icon: Bot, title: "PRD", desc: "AI clarifies, then drafts a structured PRD." },
  { icon: KanbanSquare, title: "Tasks", desc: "The PRD becomes engineering tasks on a board." },
  { icon: GitPullRequest, title: "Code", desc: "Connect a repo; PRs link to the feature." },
  { icon: Bot, title: "AI review", desc: "PRs reviewed against the requirements." },
  { icon: ShieldCheck, title: "Approval", desc: "A human signs off with a readiness brief." },
  { icon: Rocket, title: "Ship", desc: "Only approved features are marked shipped." },
];

const PRICING = [
  { name: "Free", price: "₹0", features: ["1 repository", "20 AI review credits/mo", "10 feature requests/mo"] },
  { name: "Pro", price: "₹999", features: ["10 repositories", "300 AI review credits/mo", "Unlimited requests", "Release readiness"], featured: true },
  { name: "Scale", price: "₹2,999", features: ["Unlimited everything", "Priority processing", "All premium workflows"] },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/70 px-5 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-7 items-center justify-center rounded-lg text-xs font-bold text-white shadow-sm"
            style={{ backgroundImage: "linear-gradient(135deg, var(--primary), var(--brand-accent))" }}
          >
            SF
          </div>
          <span className="font-display font-semibold tracking-tight">ShipFlow AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center sm:py-28">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1">
          <span className="size-1.5 animate-pulse rounded-full bg-brand-accent" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            AI-assisted product delivery
          </span>
        </div>
        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          From feature request to{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: "linear-gradient(120deg, var(--primary), var(--brand-accent))",
            }}
          >
            production
          </span>
          — without losing the thread.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          ShipFlow turns a request into a PRD, breaks it into tasks, reviews the
          pull requests against the requirements, and gets a human to approve the
          release.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">
              Start free <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </section>

      {/* The loop */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <p className="eyebrow text-center">The delivery loop</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className="group rounded-xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary transition-colors group-hover:bg-primary/20">
                  <s.icon className="size-4.5" />
                </span>
                <span className="font-mono text-xs text-muted-foreground/50">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          Simple pricing
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PRICING.map((p) => (
            <div
              key={p.name}
              className={`rounded-xl border p-6 ${p.featured ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-1 text-3xl font-semibold">
                {p.price}
                <span className="text-sm font-normal text-muted-foreground">
                  {p.name === "Free" ? "" : "/mo"}
                </span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {p.features.map((f, i) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full" variant={p.featured ? "default" : "outline"}>
                <Link href="/sign-up">Get started</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t px-6 py-8 text-center text-sm text-muted-foreground">
        ShipFlow AI · Feature → PRD → Tasks → Code → AI Review → Approval → Ship
      </footer>
    </main>
  );
}

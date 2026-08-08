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
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            SF
          </div>
          <span className="font-semibold tracking-tight">ShipFlow AI</span>
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
        <div className="mx-auto mb-5 inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
          AI-assisted product delivery
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
          From feature request to production — without losing the thread.
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
        <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          The delivery loop
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.title} className="rounded-xl border bg-card p-5">
              <s.icon className="size-5 text-primary" />
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

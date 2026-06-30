import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-24">
      <div className="space-y-4">
        <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
          AI-assisted product delivery
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          From feature request to production — without losing the thread.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          ShipFlow turns a request into a PRD, breaks it into tasks, reviews the
          pull requests against the requirements, and gets a human to approve the
          release. Idea → PRD → Tasks → Code → AI Review → Approval → Ship.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/sign-up">Get started</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}

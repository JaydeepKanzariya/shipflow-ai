"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@shipflow/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  // When the user hasn't manually edited the slug, derive it from the name.
  const [manualSlug, setManualSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const slug = manualSlug ?? slugify(name);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await authClient.organization.create({
        name: name.trim(),
        slug: slug.trim(),
      });
      if (error || !data) {
        throw new Error(error?.message ?? "Could not create workspace");
      }
      // Make the new org the active one for this session.
      await authClient.organization.setActive({ organizationId: data.id });
      toast.success(`Workspace "${data.name}" created`);
      router.push(`/${data.slug}/dashboard`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create your workspace</CardTitle>
        <CardDescription>
          A workspace holds your projects, repositories, and feature requests.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Workspace name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">URL slug</Label>
            <div className="flex items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring">
              <span className="pl-3 text-sm text-muted-foreground">shipflow.app/</span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setManualSlug(slugify(e.target.value))}
                placeholder="acme"
                className="border-0 pl-1 shadow-none focus-visible:ring-0"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Create workspace
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

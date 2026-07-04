"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SOURCES = [
  { value: "MANUAL", label: "Manual entry" },
  { value: "EMAIL", label: "Email" },
  { value: "TICKET", label: "Support ticket" },
  { value: "CALL", label: "Customer call" },
] as const;

export function NewRequestDialog({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [source, setSource] = useState<string>("MANUAL");

  const projects = useQuery(trpc.project.list.queryOptions());
  const ensureDefault = useMutation(trpc.project.ensureDefault.mutationOptions());
  const create = useMutation(
    trpc.featureRequest.create.mutationOptions({
      onSuccess: ({ id }) => {
        toast.success("Request submitted — the AI is reviewing it.");
        setOpen(false);
        setTitle("");
        setRawText("");
        router.push(`/${orgSlug}/features/${id}`);
        router.refresh();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Use the first project, or create a default one.
    let projectId = projects.data?.[0]?.id;
    if (!projectId) {
      const p = await ensureDefault.mutateAsync();
      projectId = p.id;
    }
    create.mutate({ projectId, title, rawText, source: source as never });
  }

  const busy = create.isPending || ensureDefault.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New request
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New feature request</DialogTitle>
          <DialogDescription>
            Describe the request. The AI will clarify, educate, or draft a PRD.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add dark mode to the dashboard"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rawText">Details</Label>
            <Textarea
              id="rawText"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="What does the customer want, and why? Any context helps the AI."
              rows={5}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

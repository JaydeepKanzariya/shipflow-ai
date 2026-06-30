// Re-export the shared cn() so shadcn components (which import "@/lib/utils")
// and the rest of the app use a single implementation.
export { cn } from "@shipflow/ui/cn";

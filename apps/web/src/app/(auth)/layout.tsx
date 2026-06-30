export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          SF
        </div>
        <h1 className="text-xl font-semibold tracking-tight">ShipFlow AI</h1>
        <p className="text-sm text-muted-foreground">
          From feature request to production.
        </p>
      </div>
      {children}
    </div>
  );
}

import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/client";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ACCENTS, ACCENT_STORAGE_KEY, DEFAULT_ACCENT } from "@/lib/themes";

// Display: engineered, precise. Body: dense-UI workhorse. Mono: the data
// layer — IDs, status, metrics, code — in the subject's native voice.
const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShipFlow AI — from feature request to production",
  description:
    "AI-assisted product delivery: a request becomes a PRD, tasks, reviewed code, and a shipped feature — with a human approval gate.",
};

// Apply the saved accent theme before first paint (no flash). Uses ACCENTS
// as the single source of truth, serialized into a tiny inline script.
const accentMap = Object.fromEntries(
  ACCENTS.map((a) => [a.id, [a.primary, a.primaryForeground, a.brandAccent]]),
);
const accentScript = `(function(){try{var m=${JSON.stringify(accentMap)};var id=localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)})||${JSON.stringify(DEFAULT_ACCENT)};var v=m[id];if(!v)return;var r=document.documentElement.style;r.setProperty('--primary',v[0]);r.setProperty('--primary-foreground',v[1]);r.setProperty('--brand-accent',v[2]);r.setProperty('--ring',v[0]);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: accentScript }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

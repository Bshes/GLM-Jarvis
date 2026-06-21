import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "A.E.O.N. — Autonomous Entity for Orchestration & Navigation",
  description:
    "A stateful, event-driven, multi-agent autonomous AI operating system. Perceive → Think → Act → Reflect, with graph + vector memory, LLM routing, and tiered real-world execution.",
  keywords: [
    "A.E.O.N.",
    "autonomous AI",
    "multi-agent",
    "orchestrator",
    "LangGraph",
    "AI operating system",
  ],
  authors: [{ name: "A.E.O.N. Core" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

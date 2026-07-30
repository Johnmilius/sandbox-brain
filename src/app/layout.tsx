import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/shell/app-shell";
import { getAuthedUser } from "@/lib/supabase/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Sandbox Brain",
  description:
    "Team hub for time tracking, prompts, linked notes, and reusable knowledge.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await getAuthedUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className={`${geistSans.className} min-h-full flex flex-col`}>
        {user ? <AppShell>{children}</AppShell> : children}
        <Toaster />
      </body>
    </html>
  );
}

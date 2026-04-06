// app/layout.tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevSim — Ship code, not resumes",
  description:
    "A developer simulation platform where you work alongside AI teammates, complete real engineering tasks, and get multi-dimensional evaluations.",
  openGraph: {
    title: "DevSim",
    description: "Ship code, not resumes.",
    siteName: "DevSim",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#6C5CE7",
          colorBackground: "#0C0C14",
          colorText: "#E8E6F0",
          colorInputBackground: "#13131F",
          colorInputText: "#C8C6D8",
        },
      }}
    >
      <html
        lang="en"
        className={`${GeistSans.variable} ${GeistMono.variable}`}
      >
        <body className="min-h-dvh bg-ds-base text-ds-text-secondary antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
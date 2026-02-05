import type { Metadata } from "next";
import "./global.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Shell } from "@/components/layout/shell";

export const metadata: Metadata = {
  title: "FlinkReactor Dashboard",
  description: "Real-time monitoring dashboard for FlinkReactor pipelines",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-fr-bg font-sans text-white antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

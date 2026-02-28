import type { Metadata } from "next";
import "./global.css";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Shell } from "@/components/layout/shell";

export const metadata: Metadata = {
  title: "FlinkReactor Dashboard",
  description: "Real-time monitoring dashboard for FlinkReactor pipelines",
};

/**
 * Inline script that runs before React hydration to apply the saved theme
 * class, preventing a flash of the wrong theme on page load.
 */
const themeScript = `(function(){try{var t=localStorage.getItem("fr-theme");if(t==="light"||t==="dark"){document.documentElement.classList.remove("dark","light");document.documentElement.classList.add(t)}var p=localStorage.getItem("fr-palette");if(p==="tokyo-night"||p==="gruvpuccin"){document.documentElement.dataset.palette=p}}catch(e){}})()`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-fr-bg font-sans text-fg antialiased">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

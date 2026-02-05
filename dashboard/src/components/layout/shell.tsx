"use client";

import { useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";
import { CommandPalette } from "./command-palette";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  const toggleCommandPalette = useUiStore((s) => s.toggleCommandPalette);

  // cmd+k / ctrl+k keyboard listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCommandPalette]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { cn } from "../lib/cn";

export interface TextViewerProps {
  text: string;
  className?: string;
  /** Maximum height of the viewer. Default: 480px */
  maxHeight?: string;
  /** Whether to show line numbers. Default: true */
  showLineNumbers?: boolean;
  /** Whether to show the copy button. Default: true */
  showCopyButton?: boolean;
}

/**
 * TextViewer — readonly monospace text pane with line numbers and copy button.
 *
 * Perfect for displaying logs, code snippets, configuration files, etc.
 */
export function TextViewer({
  text,
  className,
  maxHeight = "480px",
  showLineNumbers = true,
  showCopyButton = true,
}: TextViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const lines = text.split("\n");

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-dash-border bg-dash-surface",
        className,
      )}
    >
      {/* Copy button */}
      {showCopyButton && (
        <div className="absolute right-2 top-2 z-10">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-md bg-dash-elevated p-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  {copied ? (
                    <Check className="size-3.5 text-job-running" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "Copied!" : "Copy all"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Scrollable text area */}
      <div
        ref={containerRef}
        className="scrollbar-hide overflow-auto p-3 pr-10 font-mono text-[13px] leading-6"
        style={{ maxHeight }}
      >
        {lines.map((line, i) => (
          <div key={i} className="flex">
            {showLineNumbers && (
              <span className="mr-4 inline-block w-8 shrink-0 select-none text-right text-zinc-600">
                {i + 1}
              </span>
            )}
            <span className="min-w-0 break-all text-zinc-300">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

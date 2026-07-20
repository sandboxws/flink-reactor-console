// The tap-panel webview document (tap-visualization, Tier-3 feature 13).
//
// Hardened exactly like the DAG panel: a strict CSP with `default-src 'none'`,
// a per-load nonce gating the one bundled script, and styles limited to
// `'unsafe-inline'`. The renderer builds every tap entry as *text* nodes —
// manifest strings (including `observationSql`) are never inserted as HTML —
// so server-provided content cannot inject markup.

import type * as vscode from "vscode"

/** A per-load nonce for the CSP `script-src`. */
export function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let text = ""
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

export function buildTapHtml(
  webview: vscode.Webview,
  scriptUri: vscode.Uri,
  nonce: string,
): string {
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${webview.cspSource}`,
  ].join("; ")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pipeline Taps</title>
  <style>
    html, body { height: 100%; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    #status {
      padding: 4px 10px; font-size: 12px;
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      color: var(--vscode-inputValidation-errorForeground, #fff);
      border-bottom: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
    }
    #status[hidden] { display: none; }
    #console-target {
      padding: 6px 12px; font-size: 12px;
      color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-panel-border, #444);
    }
    #console-target code {
      font-family: var(--vscode-editor-font-family, monospace);
      color: var(--vscode-textLink-foreground, #3794ff);
    }
    #empty {
      padding: 28px 20px; text-align: center;
      color: var(--vscode-descriptionForeground); font-size: 13px; line-height: 1.6;
    }
    #empty[hidden] { display: none; }
    #empty code {
      font-family: var(--vscode-editor-font-family, monospace);
      background: var(--vscode-textCodeBlock-background, #1e1e1e);
      padding: 1px 5px; border-radius: 3px;
    }
    #taps { padding: 6px 0 16px; overflow-y: auto; }
    #taps.dimmed { opacity: 0.45; transition: opacity 150ms ease; }
    .tap {
      margin: 8px 12px; padding: 10px 12px; border-radius: 6px;
      border: 1px solid var(--vscode-panel-border, #444);
      background: var(--vscode-editorWidget-background, #252526);
    }
    .tap.added { animation: fr-fade-in 240ms ease; }
    @keyframes fr-fade-in { from { opacity: 0; } to { opacity: 1; } }
    .tap .head {
      display: flex; align-items: center; gap: 8px; cursor: pointer;
    }
    .tap .head:hover .op { text-decoration: underline; }
    .tap .op { font-weight: 600; }
    .tap .tapname { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .badge {
      font-size: 10px; padding: 1px 7px; border-radius: 8px;
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .badge.strategy {
      background: var(--vscode-badge-background, #4d4d4d);
      color: var(--vscode-badge-foreground, #fff);
    }
    .badge.auto {
      background: var(--vscode-inputValidation-warningBackground, #5d5400);
      color: var(--vscode-inputValidation-warningForeground, #fff);
      border: 1px dashed var(--vscode-inputValidation-warningBorder, #b89500);
    }
    .badge.explicit {
      background: var(--vscode-charts-purple, #7c3aed); color: #fff;
    }
    .tap .meta {
      margin-top: 6px; font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .tap .meta code { font-family: var(--vscode-editor-font-family, monospace); }
    .tap table {
      border-collapse: collapse; margin: 6px 0 0; font-size: 12px;
    }
    .tap td { padding: 1px 12px 1px 0; }
    .tap td.type { color: var(--vscode-symbolIcon-typeParameterForeground, #4ec9b0); }
    .tap details { margin-top: 8px; }
    .tap summary { cursor: pointer; font-size: 12px; color: var(--vscode-descriptionForeground); }
    .tap pre {
      margin: 6px 0 0; padding: 8px; white-space: pre-wrap; word-break: break-word;
      background: var(--vscode-textCodeBlock-background, #1e1e1e);
      border-radius: 4px; font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px; max-height: 280px; overflow-y: auto;
    }
  </style>
</head>
<body>
  <div id="status" hidden></div>
  <div id="console-target"></div>
  <div id="empty">Waiting for the pipeline to synthesize…</div>
  <div id="taps"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
}

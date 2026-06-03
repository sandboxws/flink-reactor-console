import type * as vscode from "vscode"

/** A per-load nonce for the CSP `script-src` (only the bundled webview script
 *  bearing this nonce may execute). Shared shape with `graph/html.ts`. */
export function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let text = ""
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

/**
 * The SQL-preview webview document. Hardened like the DAG webview: strict CSP
 * with `default-src 'none'`, a per-load nonce gating the one bundled script,
 * styles limited to `'unsafe-inline'`. All SQL is inserted by the script as
 * text nodes (never as HTML), so server-provided statements can never inject
 * markup. The SQL lives in non-editable `<pre>` blocks — copy works via normal
 * selection, edits do not (the preview is read-only; editing is in the `.tsx`).
 */
export function buildHtml(
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
  <title>SQL Preview</title>
  <style>
    html, body { height: 100%; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    /* Stale / failure banner — non-blocking, pinned to the top. */
    #banner {
      position: sticky; top: 0; z-index: 5;
      display: flex; align-items: center; gap: 8px;
      padding: 5px 12px; font-size: 12px;
      background: var(--vscode-inputValidation-warningBackground, #5d4d1a);
      color: var(--vscode-inputValidation-warningForeground, #fff);
      border-bottom: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
    }
    #banner[hidden] { display: none; }
    #banner .grow { flex: 1; }
    #banner button {
      font: inherit; cursor: pointer;
      color: var(--vscode-button-secondaryForeground, #fff);
      background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.15));
      border: none; border-radius: 3px; padding: 1px 8px;
    }
    #blocks { padding: 8px 10px 40px; }
    /* A section group separator label (SET / sources / sinks / pipeline). */
    .section-divider {
      margin: 14px 2px 6px; font-size: 10px; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.25));
      padding-bottom: 3px;
    }
    .section-divider:first-child { margin-top: 2px; }
    .block {
      margin: 0 0 10px; border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.25));
      border-radius: 5px; overflow: hidden;
      background: var(--vscode-editorWidget-background, rgba(128,128,128,0.04));
    }
    .block.active-whole {
      border-color: var(--vscode-focusBorder, #007fd4);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007fd4) inset;
    }
    .block-head {
      display: flex; align-items: baseline; gap: 8px;
      padding: 5px 10px; cursor: default;
      background: var(--vscode-editorGroupHeader-tabsBackground, rgba(128,128,128,0.08));
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
    }
    .block-label { font-weight: 600; font-size: 12px; }
    .block-section {
      margin-left: auto; font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--vscode-descriptionForeground);
    }
    .block-sql {
      margin: 0; padding: 8px 10px; white-space: pre-wrap; word-break: break-word;
      user-select: text;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 12px);
      line-height: 1.5; color: var(--vscode-editor-foreground, #ddd);
    }
    /* A contributed sub-statement span — clickable for SQL→DSL nav. */
    .frag { cursor: pointer; border-radius: 2px; }
    .frag:hover { background: var(--vscode-editor-hoverHighlightBackground, rgba(120,170,255,0.12)); }
    .frag.active {
      background: var(--vscode-editor-findMatchHighlightBackground, rgba(255,220,100,0.35));
      outline: 1px solid var(--vscode-editor-findMatchHighlightBorder, transparent);
    }
    /* Brief flash when a node is revealed from the SQL→DSL round trip lands. */
    .block.flash { animation: fr-flash 0.9s ease-out; }
    @keyframes fr-flash {
      from { background: var(--vscode-editor-findMatchHighlightBackground, rgba(255,220,100,0.35)); }
      to { background: transparent; }
    }
    #empty {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 6px; padding: 20px;
      text-align: center; color: var(--vscode-descriptionForeground); font-size: 13px;
    }
    #empty[hidden] { display: none; }
    #empty pre {
      max-width: 90%; white-space: pre-wrap; text-align: left;
      color: var(--vscode-errorForeground, #f44);
      font-family: var(--vscode-editor-font-family, monospace); font-size: 11px;
    }
  </style>
</head>
<body>
  <div id="banner" hidden>
    <span id="banner-text" class="grow"></span>
    <button id="banner-details" type="button">Details</button>
  </div>
  <div id="blocks"></div>
  <div id="empty">Waiting for the pipeline to synthesize…</div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
}

import type * as vscode from "vscode"

/** A per-load nonce for the CSP `script-src` (only the bundled webview script
 *  bearing this nonce may execute). */
export function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let text = ""
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

/**
 * The webview document. Hardened per VS Code guidance: a strict CSP with
 * `default-src 'none'`, a per-load nonce gating the one bundled script, and
 * styles limited to `'unsafe-inline'` (stylesheets cannot execute). All graph
 * content is built by the script as text/SVG — never as HTML from model
 * strings — so server-provided labels/SQL cannot inject markup.
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
  <title>Pipeline DAG</title>
  <style>
    html, body { height: 100%; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      overflow: hidden;
    }
    #status {
      position: absolute; top: 0; left: 0; right: 0;
      padding: 4px 10px; font-size: 12px;
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      color: var(--vscode-inputValidation-errorForeground, #fff);
      border-bottom: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
      z-index: 5;
    }
    #status[hidden] { display: none; }
    #canvas { width: 100%; height: 100%; display: block; }
    #canvas.dimmed { opacity: 0.4; transition: opacity 150ms ease; }
    #empty {
      position: absolute; inset: 0; display: flex;
      align-items: center; justify-content: center;
      color: var(--vscode-descriptionForeground); font-size: 13px;
    }
    #empty[hidden] { display: none; }
    .fr-node { cursor: pointer; }
    .fr-node rect {
      stroke: var(--vscode-contrastBorder, rgba(0,0,0,0.3));
      stroke-width: 1; rx: 6; ry: 6;
    }
    .fr-node.selected rect {
      stroke: var(--vscode-focusBorder, #007fd4); stroke-width: 2.5;
    }
    .fr-node text { fill: #fff; font-size: 12px; pointer-events: none; }
    .fr-node .kindlabel { font-size: 9px; opacity: 0.85; text-transform: uppercase; }
    .fr-edge { fill: none; stroke: var(--vscode-editorIndentGuide-activeBackground, #888); stroke-width: 1.5; }
    .fr-edge.cross { stroke: var(--vscode-editorError-foreground, #f44336); stroke-width: 2; stroke-dasharray: 5 3; }
    .fr-badge text { font-size: 11px; font-weight: bold; fill: #fff; pointer-events: none; }
    #hover {
      position: absolute; max-width: 420px; pointer-events: none; z-index: 10;
      background: var(--vscode-editorHoverWidget-background, #252526);
      color: var(--vscode-editorHoverWidget-foreground, #ccc);
      border: 1px solid var(--vscode-editorHoverWidget-border, #454545);
      border-radius: 4px; padding: 8px 10px; font-size: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    #hover[hidden] { display: none; }
    #hover .title { font-weight: bold; margin-bottom: 4px; }
    #hover .muted { color: var(--vscode-descriptionForeground); }
    #hover table { border-collapse: collapse; margin: 4px 0; }
    #hover td { padding: 0 8px 0 0; vertical-align: top; }
    #hover td.type { color: var(--vscode-symbolIcon-typeParameterForeground, #4ec9b0); }
    #hover pre {
      margin: 4px 0 0; padding: 6px; white-space: pre-wrap; word-break: break-word;
      background: var(--vscode-textCodeBlock-background, #1e1e1e);
      border-radius: 3px; font-family: var(--vscode-editor-font-family, monospace); font-size: 11px;
    }
  </style>
</head>
<body>
  <div id="status" hidden></div>
  <div id="empty">Waiting for the pipeline to synthesize…</div>
  <svg id="canvas" xmlns="http://www.w3.org/2000/svg"></svg>
  <div id="hover" hidden></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
}

import type * as vscode from "vscode"

/** A per-load nonce for the CSP `script-src` (only the bundled webview script
 *  bearing this nonce may execute). Shared shape with `preview/html.ts`. */
export function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let text = ""
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

/**
 * The CRD-preview webview document. Hardened like the SQL/DAG webviews: strict
 * CSP with `default-src 'none'`, a per-load nonce gating the one bundled script,
 * styles limited to `'unsafe-inline'`. All YAML is inserted by the script as
 * text nodes (never as HTML), so server-provided YAML can never inject markup.
 * The YAML lives in a non-editable `<pre>` — the preview is read-only (the
 * artifacts are generated output; editing happens in the `.tsx`).
 */
export function buildCrdHtml(
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
  <title>CRD Preview</title>
  <style>
    html, body { height: 100%; margin: 0; padding: 0; }
    body {
      display: flex; flex-direction: column;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
    }
    /* Header: pipeline name + artifact-set label + save-all. */
    #header {
      display: flex; align-items: center; gap: 10px;
      padding: 6px 12px;
      background: var(--vscode-editorGroupHeader-tabsBackground, rgba(128,128,128,0.08));
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.25));
    }
    #pipeline-name { font-weight: 600; font-size: 13px; }
    #kind-label {
      font-size: 11px; padding: 1px 8px; border-radius: 10px;
      background: var(--vscode-badge-background, #4d4d4d);
      color: var(--vscode-badge-foreground, #fff);
    }
    .grow { flex: 1; }
    button {
      font: inherit; font-size: 12px; cursor: pointer;
      color: var(--vscode-button-secondaryForeground, #fff);
      background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.12));
      border: none; border-radius: 3px; padding: 2px 10px;
    }
    button:hover { background: var(--vscode-button-secondaryHoverBackground, rgba(255,255,255,0.2)); }
    /* Stale / failure banner. */
    #banner {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 12px; font-size: 12px;
      background: var(--vscode-inputValidation-warningBackground, #5d4d1a);
      color: var(--vscode-inputValidation-warningForeground, #fff);
      border-bottom: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
    }
    #banner[hidden] { display: none; }
    /* Tab strip. */
    #tabs {
      display: flex; flex-wrap: wrap; gap: 2px;
      padding: 4px 8px 0; overflow-x: auto;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.25));
    }
    .tab {
      display: flex; align-items: baseline; gap: 6px;
      padding: 4px 10px; cursor: pointer; user-select: none;
      border: 1px solid transparent; border-bottom: none;
      border-top-left-radius: 5px; border-top-right-radius: 5px;
      color: var(--vscode-descriptionForeground);
    }
    .tab:hover { background: var(--vscode-list-hoverBackground, rgba(128,128,128,0.12)); }
    .tab.active {
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      border-color: var(--vscode-panel-border, rgba(128,128,128,0.35));
    }
    .tab-label { font-size: 12px; font-weight: 600; }
    .tab-kind {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--vscode-descriptionForeground);
    }
    /* Per-artifact toolbar. */
    #toolbar {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 12px;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.15));
    }
    #toolbar[hidden] { display: none; }
    #active-filename {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px; color: var(--vscode-descriptionForeground);
    }
    /* Read-only YAML body. */
    #yaml {
      flex: 1; margin: 0; padding: 10px 12px 40px; overflow: auto;
      white-space: pre; tab-size: 2;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--vscode-editor-font-size, 12px);
      line-height: 1.5; color: var(--vscode-editor-foreground, #ddd);
    }
    #yaml[hidden] { display: none; }
    .y-key { color: var(--vscode-symbolIcon-propertyForeground, #9cdcfe); }
    .y-string { color: var(--vscode-debugTokenExpression-string, #ce9178); }
    .y-number { color: var(--vscode-debugTokenExpression-number, #b5cea8); }
    .y-comment { color: var(--vscode-descriptionForeground, #6a9955); font-style: italic; }
    .y-punct { color: var(--vscode-descriptionForeground, #808080); }
    /* Error / empty state. */
    #empty {
      flex: 1; display: flex; flex-direction: column;
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
  <div id="header">
    <span id="pipeline-name"></span>
    <span id="kind-label"></span>
    <span class="grow"></span>
    <button id="save-all" type="button" title="Write every artifact to dist/&lt;pipeline&gt;/">Save all to dist/</button>
  </div>
  <div id="banner" hidden>
    <span id="banner-text" class="grow"></span>
    <button id="banner-details" type="button">Details</button>
  </div>
  <div id="tabs" role="tablist"></div>
  <div id="toolbar" hidden>
    <span id="active-filename" class="grow"></span>
    <button id="copy" type="button" title="Copy this artifact's YAML">Copy</button>
    <button id="save" type="button" title="Write this artifact to dist/&lt;pipeline&gt;/">Save to dist/</button>
  </div>
  <pre id="yaml" tabindex="0"></pre>
  <div id="empty">Waiting for the pipeline to synthesize…</div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
}

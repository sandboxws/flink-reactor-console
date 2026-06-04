import type * as vscode from "vscode"
import { getNonce } from "../graph/html.js"

export { getNonce }

/**
 * The designer webview document: palette (left) | canvas (center) | prop form
 * (right), plus a toolbar for draft mode and a status strip for refusals.
 * Hardened exactly like the DAG webview: `default-src 'none'`, a per-load
 * nonce gating the one bundled script, inline styles only. All canvas/form
 * content is built by the script as text/SVG — never as HTML from model
 * strings — so server-provided labels/values cannot inject markup.
 */
export function buildDesignerHtml(
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
  <title>Pipeline Designer</title>
  <style>
    html, body { height: 100%; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex; flex-direction: column; overflow: hidden;
    }
    #toolbar {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 8px; border-bottom: 1px solid var(--vscode-panel-border, #333);
      flex: 0 0 auto;
    }
    #toolbar .filekind { font-size: 11px; color: var(--vscode-descriptionForeground); }
    #toolbar button, #form button {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #fff);
      border: none; border-radius: 3px; padding: 3px 10px; cursor: pointer; font-size: 12px;
    }
    #toolbar button:disabled, #form button:disabled { opacity: 0.45; cursor: not-allowed; }
    #toolbar button.primary {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #fff);
    }
    #status {
      padding: 4px 10px; font-size: 12px; flex: 0 0 auto;
      background: var(--vscode-inputValidation-warningBackground, #5a4a1d);
      color: var(--vscode-inputValidation-warningForeground, #fff);
      border-bottom: 1px solid var(--vscode-inputValidation-warningBorder, #b89500);
    }
    #status.error {
      background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
      border-bottom-color: var(--vscode-inputValidation-errorBorder, #be1100);
    }
    #status[hidden] { display: none; }
    #main { display: flex; flex: 1 1 auto; min-height: 0; }
    #palette {
      flex: 0 0 172px; overflow-y: auto; padding: 6px;
      border-right: 1px solid var(--vscode-panel-border, #333);
    }
    #palette h3 {
      margin: 8px 2px 4px; font-size: 10px; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--vscode-descriptionForeground);
    }
    .palette-item {
      padding: 3px 8px; margin: 2px 0; border-radius: 4px; font-size: 12px;
      border: 1px solid var(--vscode-contrastBorder, rgba(255,255,255,0.12));
      cursor: grab; user-select: none;
    }
    .palette-item[draggable="false"] { cursor: default; opacity: 0.6; }
    #canvas-wrap { flex: 1 1 auto; overflow: auto; position: relative; }
    #empty {
      position: absolute; inset: 0; display: flex;
      align-items: center; justify-content: center; text-align: center;
      color: var(--vscode-descriptionForeground); font-size: 13px; padding: 0 24px;
    }
    #empty[hidden] { display: none; }
    #canvas { display: block; }
    #canvas.dimmed { opacity: 0.4; transition: opacity 150ms ease; }
    .fr-node { cursor: pointer; }
    .fr-node rect {
      stroke: var(--vscode-contrastBorder, rgba(0,0,0,0.3));
      stroke-width: 1; rx: 6; ry: 6;
    }
    .fr-node.selected rect { stroke: var(--vscode-focusBorder, #007fd4); stroke-width: 2.5; }
    .fr-node.droptarget rect { stroke: var(--vscode-charts-green, #4caf50); stroke-width: 3; }
    .fr-node.dropinvalid rect { stroke: var(--vscode-editorError-foreground, #f44336); stroke-width: 3; stroke-dasharray: 4 3; }
    .fr-node text { fill: #fff; font-size: 12px; pointer-events: none; }
    .fr-node .kindlabel { font-size: 9px; opacity: 0.85; text-transform: uppercase; }
    .fr-edge { fill: none; stroke: var(--vscode-editorIndentGuide-activeBackground, #888); stroke-width: 1.5; }
    .fr-badge text { font-size: 11px; font-weight: bold; fill: #fff; pointer-events: none; }
    #form {
      flex: 0 0 280px; overflow-y: auto; padding: 8px 10px;
      border-left: 1px solid var(--vscode-panel-border, #333); font-size: 12px;
    }
    #form h2 { margin: 0 0 2px; font-size: 13px; }
    #form .muted { color: var(--vscode-descriptionForeground); font-size: 11px; }
    #form .field { margin: 8px 0; }
    #form label { display: block; margin-bottom: 2px; }
    #form label .req { color: var(--vscode-editorError-foreground, #f44336); }
    #form input[type="text"], #form input[type="number"], #form select {
      width: 100%; box-sizing: border-box; padding: 3px 6px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #ccc);
      border: 1px solid var(--vscode-input-border, #555); border-radius: 2px;
    }
    #form input[readonly] { opacity: 0.6; }
    #form .help { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 2px; white-space: pre-wrap; }
    #form .readonly-row { display: flex; gap: 6px; align-items: center; }
    #form .readonly-row input { flex: 1 1 auto; }
    #form .actions { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
    #form .reason { font-size: 10px; color: var(--vscode-descriptionForeground); white-space: pre-wrap; }
    .legend { margin-top: 14px; border-top: 1px solid var(--vscode-panel-border, #333); padding-top: 8px; }
    .legend h3 { font-size: 11px; margin: 0 0 4px; }
    .legend p { font-size: 10px; color: var(--vscode-descriptionForeground); margin: 3px 0; }
  </style>
</head>
<body>
  <div id="toolbar">
    <button id="btn-draft" class="primary" title="Compose a brand-new static pipeline on a blank canvas">New pipeline…</button>
    <button id="btn-generate" disabled hidden>Generate .tsx</button>
    <button id="btn-discard" hidden>Discard draft</button>
    <span id="filekind" class="filekind"></span>
  </div>
  <div id="status" hidden></div>
  <div id="main">
    <div id="palette"></div>
    <div id="canvas-wrap">
      <div id="empty">Waiting for the pipeline to synthesize…</div>
      <svg id="canvas" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
    <div id="form"></div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
}

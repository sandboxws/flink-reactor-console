# Use your workspace TypeScript

VS Code ships its own bundled TypeScript, and that bundled copy **refuses to
load workspace plugins** for security. So even with the ts-plugin in your
`tsconfig.json`, it stays dormant until VS Code is pointed at your project's
TypeScript.

Run **FlinkReactor: Use Workspace TypeScript Version** and the extension sets
`typescript.tsdk` to `node_modules/typescript/lib` and offers to reload.

You can also do it manually:

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
2. Run **TypeScript: Select TypeScript Version**.
3. Choose **Use Workspace Version**.

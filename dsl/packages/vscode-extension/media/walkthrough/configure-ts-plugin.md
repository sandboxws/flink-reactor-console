# Configure the ts-plugin

FlinkReactor's in-editor JSX nesting checks and ranked completions are delivered
by `@flink-reactor/ts-plugin`, which runs **inside** TypeScript's language
service. It only activates when it is listed in your project `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@flink-reactor/dsl",
    "plugins": [{ "name": "@flink-reactor/ts-plugin" }]
  }
}
```

Run **FlinkReactor: Configure ts-plugin in tsconfig.json** and the extension
makes exactly these edits — preserving your comments and formatting, and never
touching your `paths`. It is safe to run repeatedly; it does nothing if the
plugin is already configured.

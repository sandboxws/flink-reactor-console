import type { CodegenConfig } from "@graphql-codegen/cli"

const config: CodegenConfig = {
  schema: "../server/internal/graphql/schema/*.graphqls",
  documents: "src/graphql/documents/**/*.graphql",
  generates: {
    "src/graphql/generated/types.ts": {
      plugins: ["typescript", "typescript-operations"],
      config: {
        avoidOptionals: true,
        enumsAsTypes: true,
        scalars: {
          JSON: "Record<string, unknown>",
        },
      },
    },
  },
}

export default config

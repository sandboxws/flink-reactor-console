#!/bin/bash
# PostToolUse hook: runs golangci-lint after Edit/Write on .go files
# Exit 0 = pass, Exit 2 = block (Claude must fix before continuing)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

# Skip non-Go files
[[ "$FILE_PATH" != *.go ]] && exit 0

# Skip generated files (GraphQL codegen)
[[ "$FILE_PATH" == *"/graphql/generated/"* ]] && exit 0
[[ "$FILE_PATH" == *"/graphql/model/"* ]] && exit 0

# Run golangci-lint from the server directory
cd "$CLAUDE_PROJECT_DIR/server" || exit 0

# Get the relative path of the edited file's directory
REL_DIR=$(realpath --relative-to="$CLAUDE_PROJECT_DIR/server" "$(dirname "$FILE_PATH")" 2>/dev/null)
if [ -z "$REL_DIR" ]; then
  exit 0
fi

LINT_OUTPUT=$(golangci-lint run --timeout=30s "./${REL_DIR}/..." 2>&1)
LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ]; then
  echo "$LINT_OUTPUT" | head -20 >&2
  exit 2
fi

exit 0

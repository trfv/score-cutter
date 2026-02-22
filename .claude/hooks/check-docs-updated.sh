#!/bin/sh
#
# PreToolUse hook: git commit 時に README.md / CLAUDE.md の更新漏れを警告する
# stdin から JSON を受け取り、Bash ツールの git commit コマンドかどうかを判定する
#

input=$(cat)

# tool_input.command を取得
command=$(echo "$input" | jq -r '.tool_input.command // empty')

# git commit コマンドでなければスキップ
case "$command" in
  git\ commit*) ;;
  *) exit 0 ;;
esac

# staged ファイルの中に src/ 配下の変更があるか確認
staged_src=$(git diff --cached --name-only -- 'src/' 'docs/' | head -1)

if [ -z "$staged_src" ]; then
  exit 0
fi

# README.md または CLAUDE.md が staged されているか確認
staged_docs=$(git diff --cached --name-only -- README.md CLAUDE.md)

if [ -z "$staged_docs" ]; then
  echo "src/ or docs/ files are staged but README.md and CLAUDE.md are not updated." >&2
  echo "Run /update-docs to update them, then stage the changes and retry the commit." >&2
  exit 2
fi

exit 0

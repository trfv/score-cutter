---
description: 現在の diff を確認して README.md と CLAUDE.md を更新する
---

現在の git diff（staged + unstaged + untracked）を確認し、変更内容に基づいて README.md と CLAUDE.md を最新の状態に更新してください。

## 手順

1. `git diff` と `git diff --cached` と `git status` を実行して、変更・追加されたファイルを把握する
2. 変更されたファイルの内容を読み、何が変わったかを理解する
3. 以下の観点で README.md を更新する:
   - 新機能・機能変更 → 「機能」セクション
   - ファイル追加・削除・リネーム → 「プロジェクト構成」セクション
   - テスト追加・変更 → 「テスト」セクション（テスト数・ファイル名）
   - 新しいコマンド → 「コマンド」セクション
   - 用語変更 → 各セクションの用語を統一
4. 以下の観点で CLAUDE.md を更新する:
   - 新ファイル・リネーム → Architecture セクションのファイル一覧
   - ドメイン用語の変更 → Domain Language セクション
   - 新しい規約・パターン → Key Conventions セクション
   - コマンド変更 → Commands セクション
   - 状態管理の変更 → State Management セクション
5. diff に関係ない部分は変更しない
6. README.md は日本語、CLAUDE.md は英語で記述する

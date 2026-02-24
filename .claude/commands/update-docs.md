---
description: README.md と CLAUDE.md を更新する（--force でコード全体を読んで更新）
---

README.md と CLAUDE.md を最新の状態に更新してください。

引数: $ARGUMENTS

## モード判定

- 引数に `--force` が含まれる場合 → **全体スキャンモード**
- それ以外（引数なし or `--force` なし）→ **差分モード**

---

## 差分モード（デフォルト）

### 手順

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

---

## 全体スキャンモード（--force）

diff ではなくソースコード全体を読み、README.md と CLAUDE.md の内容が実態と一致しているかを網羅的に検証・更新する。

### 手順

1. プロジェクト全体の構造を把握する:
   - `src/` 配下の全ディレクトリとファイルを Glob で列挙する
   - `docs/` 配下の全ファイルを Glob で列挙する
   - `package.json` の scripts, dependencies, devDependencies を読む
   - `vite.config.ts`, `tsconfig.json`, `eslint.config.js` 等の設定ファイルを読む
2. コアロジック（`src/core/*.ts`）を全て読み、各ファイルの公開 API・型・関数を把握する
3. Worker（`src/workers/*.ts`）を全て読む
4. 状態管理（`src/context/*.ts`）を全て読み、Action 型・Reducer の構造を把握する
5. コンポーネント（`src/components/*.tsx`）を全て読み、各ステップの機能を把握する
6. テストファイル（`__tests__/*.test.ts`）を全て読み、テスト数とカバレッジ対象を把握する
7. 既存の README.md と CLAUDE.md を読む
8. 以下の観点で README.md を更新する:
   - 「機能」セクション: 実装されている全機能がリストアップされているか
   - 「ワークフロー」セクション: ウィザードのステップ名と説明が正確か
   - 「技術スタック」セクション: 依存ライブラリのバージョンが正確か
   - 「コマンド」セクション: package.json の scripts と一致しているか
   - 「プロジェクト構成」セクション: 実際のファイル構成と一致しているか（ファイル追加・削除・リネーム・説明文）
   - 「五線検出アルゴリズム」セクション: 実装と一致しているか
   - 「PDF 組み立て」セクション: 実装と一致しているか
   - 「テスト」セクション: テストファイル数・テスト数（`npm test` を実行して確認）・ファイル名・説明が正確か
9. 以下の観点で CLAUDE.md を更新する:
   - Commands セクション: package.json の scripts と一致しているか
   - Architecture セクション: 全ファイルの一覧と説明が正確か
   - Core Domain セクション: 各ファイルの公開 API の説明が正確か
   - State Management セクション: Action 型・Reducer の構造が正確か
   - Web Workers セクション: Worker の構成が正確か
   - Detection Pipeline セクション: パイプラインの説明が正確か
   - Domain Language セクション: 用語の定義が正確か
   - Key Conventions セクション: 規約が実態と一致しているか
   - Test coverage セクション: カバレッジ対象のディレクトリが正確か
10. README.md は日本語、CLAUDE.md は英語で記述する
11. 不一致を発見したら修正し、修正内容を箇条書きでまとめて報告する

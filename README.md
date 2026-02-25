# Score Cutter

総譜（フルスコア）PDF から個別のパート譜を自動抽出する Web アプリケーション。
[Partifi](http://partifi.org/) および [Divisi](https://divisi.hv-serve.com/) を参考に開発。

全ての処理がブラウザ内で完結するため、バックエンドサーバー不要。PDF がサーバーに送信されることはありません。

## 機能

- PDF 総譜のアップロード（ドラッグ＆ドロップ対応）
- 水平投影法による五線段の自動検出
- 組段（System）境界の手動編集（任意位置でのダブルクリック分割、結合：区切り線ダブルクリック / Delete キー、ドラッグ移動）
- 区切り線（Separator）のドラッグ操作・キーボード操作（Arrow キーで移動、Tab でフォーカス移動）による譜表境界の手動調整
- 譜表の追加（空白部分ダブルクリック）、分割（譜表上ダブルクリック）、結合（区切り線ダブルクリック）、削除
- 楽器名ラベル付け（現在ページの各組段ごとにラベルを入力、組段単位で全組段に一括適用）
- ステップ別バリデーションインジケーター（譜表数の一致、ラベル完全性・重複・順序の整合性を自動チェック）
- パート別 PDF のリアルタイムプレビュー（組版済みPDFをCanvas描画）
- パート別 PDF 生成・ダウンロード（ベクター品質を保持）
- 全パート一括 ZIP ダウンロード
- Undo/Redo（Ctrl+Z / Ctrl+Y）
- Web Worker による並列検出処理
- ダーク/ライトテーマ切替
- 組段ステップ・譜表ステップにデータ構造サイドバー（組段グループ、譜表の PDF 座標をリアルタイム表示）
- 日本語・英語 UI 切替
- ステップ別アプリ内ヘルプパネル（ヘッダーの「?」ボタンから表示）
- モバイル・タブレットレスポンシブ対応（768px / 480px 2段階ブレークポイント、タッチ操作最適化）

## チュートリアル / Tutorial

操作方法の詳細は [チュートリアル](docs/tutorial.md) を参照してください。
For detailed usage instructions, see the [Tutorial](docs/tutorial.en.md).

## ワークフロー

1. **インポート** — PDF をアップロード
2. **組段指定** — 組段境界を自動検出 + 手動編集
3. **譜表分割** — 組段内の譜表を自動検出 + 手動調整
4. **ラベル付与** — 各譜表に楽器名を割り当て
5. **エクスポート** — パート PDF のプレビュー＆ダウンロード

## 技術スタック

| 用途 | ライブラリ |
|------|-----------|
| UI フレームワーク | React 19 + TypeScript |
| ビルドツール | Vite 7 |
| PDF レンダリング | pdfjs-dist 5 (pdf.js) |
| PDF 生成 | pdf-lib 1.17 |
| ZIP 生成 | JSZip |
| 多言語対応 | react-i18next |
| テスト | Vitest + React Testing Library + jsdom |
| E2E テスト | Playwright |
| スタイリング | CSS Modules + CSS カスタムプロパティ (デザイントークン) |

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開く。

## コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run preview` | ビルド結果のプレビュー |
| `npm test` | テスト実行 |
| `npm run test:coverage` | カバレッジ付きテスト実行（100% 閾値） |
| `npm run test:watch` | テストをウォッチモードで実行 |
| `npm run test:e2e` | Playwright E2E テスト実行 |
| `npm run test:e2e:ui` | Playwright インタラクティブ UI モード |
| `npm run lint` | ESLint 実行 |
| `npm run knip` | 未使用コード検出 |
| `npm run prepare` | Git hooks の設定 (.githooks/pre-commit) |

## プロジェクト構成

```
src/
  core/                          # コアロジック（純粋関数、DOM 非依存）
    staffModel.ts                #   データ型定義 (Staff, System, Part, PageDimension) + ラベル一括適用 + バリデーション
    separatorModel.ts            #   区切り線モデル (Separator 算出、ドラッグ・分割・結合・追加) + 組段のみの境界操作
    systemDetector.ts            #   水平投影データから組段境界を検出（ページ端まで拡張）
    projectionAnalysis.ts        #   空白帯検出・コンテンツ境界算出（共通ユーティリティ）
    geometry.ts                  #   矩形演算ユーティリティ
    coordinateMapper.ts          #   Canvas ピクセル座標 ↔ PDF 座標 変換
    imageProcessing.ts           #   グレースケール / 二値化 / 水平投影
    staffDetector.ts             #   空白帯検出 → 譜表境界算出
    pdfLoader.ts                 #   pdf.js ラッパー（ロード・レンダリング）
    partAssembler.ts             #   pdf-lib でパート PDF を組み立て
    zipExporter.ts               #   全パート一括 ZIP 生成
    undoHistory.ts               #   Undo/Redo 履歴管理
    __tests__/                   #   コアロジックの単体テスト (12 ファイル)
  workers/                       # Web Worker 並列処理
    detectionPipeline.ts         #   検出パイプライン（画像処理→組段・譜表検出）
    detectionWorker.ts           #   Worker エントリーポイント（handleMessage を export）
    workerPool.ts                #   Worker プール管理
    workerProtocol.ts            #   Worker 間メッセージ型定義
    __tests__/                   #   Worker の単体テスト (3 ファイル)
  components/                    # React コンポーネント（各 .tsx に対応する .module.css あり）
    ImportStep.tsx               #   PDF アップロード画面
    SystemStep.tsx               #   組段検出 + 組段境界の手動編集画面（組段構造サイドバー付き）
    StaffStep.tsx                #   譜表境界の手動調整画面（譜表構造サイドバー付き）
    LabelStep.tsx                #   楽器名ラベル付け画面
    ExportStep.tsx               #   パート PDF プレビュー＆ダウンロード画面
    StepToolbar.tsx              #   統合ナビゲーションバー（ステップ遷移 + ページ送り）
    PageCanvas.tsx               #   PDF ページの Canvas レンダリング
    SystemOverlay.tsx            #   組段境界の可視化 + 分割・結合・ドラッグ
    SeparatorOverlay.tsx         #   譜表区切り線の可視化 + ドラッグ・分割・結合・削除
    StatusIndicator.tsx          #   バリデーション結果のアイコン＋テキスト表示
    HelpPanel.tsx                #   ステップ別ヘルプモーダル
    Icons.tsx                    #   SVG アイコンコンポーネント集
  hooks/                         # カスタムフック
    useUndoRedoKeyboard.ts       #   Ctrl+Z / Ctrl+Y キーボードショートカット
    useCanvasDisplaySize.ts      #   Canvas 表示サイズ追跡フック
  context/                       # グローバル状態管理
    projectContextDefs.ts        #   型定義 (ProjectState, ProjectAction, WizardStep)
    ProjectContext.tsx            #   Provider + Reducer (useReducer + Undo/Redo)
    projectHooks.ts              #   カスタムフック (useProject, useProjectDispatch)
    __tests__/                   #   状態管理の単体テスト (3 ファイル)
  i18n/
    ja.json                      # 日本語翻訳
    en.json                      # 英語翻訳
    index.ts                     # i18n 初期設定
  App.tsx                        # ウィザード UI + ステップインジケーター
  App.module.css                 # App レイアウトスタイル
  theme.css                      # デザイントークン（テーマカラー、スペーシング、タイポグラフィ）
  index.css                      # グローバルスタイル
  main.tsx                       # エントリーポイント
  test-setup.ts                  # Vitest テストセットアップ
docs/
  tutorial.md                    # 操作チュートリアル（日本語）
  tutorial.en.md                 # 操作チュートリアル（英語）
  images/tutorial/               # チュートリアル用スクリーンショット（12枚）
  ubiquitous-language.md         # ドメイン駆動設計用語集
e2e/                             # Playwright E2E テスト
  fixtures/pdf.ts                #   共通フィクスチャ（PDF アップロード等）
  import.spec.ts                 #   インポートステップ
  detect.spec.ts                 #   組段検出ステップ
  label.spec.ts                  #   ラベル付与ステップ
  export.spec.ts                 #   エクスポートステップ
  full-flow.spec.ts              #   全ステップ通しフロー
  mobile.spec.ts                 #   モバイルレスポンシブ（Pixel 5 ビューポート）
```

## 五線検出アルゴリズム

水平投影法（Horizontal Projection）による2段階検出:

**共通前処理**（ページごと）:

1. PDF ページを 150 DPI で Canvas にレンダリング
2. ピクセルをグレースケールに変換 (`0.299R + 0.587G + 0.114B`)
3. 閾値 128 で二値化（黒=1, 白=0）
4. 各行の黒ピクセル数を集計（水平投影プロファイル）

**Phase 1: 組段検出**（組段指定ステップ）:

5. 投影値が最大値の 5% 以下の行が **50px 以上**連続する帯を「組段間空白」として検出
6. 空白帯の前後でコンテンツ境界を特定し、組段（System）エンティティを生成
7. 最初の組段の上端をページ上端（0px）に、最後の組段の下端をページ下端に拡張

**Phase 2: 譜表検出**（譜表分割ステップ）:

8. 各組段の範囲内で、投影値が最大値の 5% 以下の行が **15px 以上**連続する帯を「譜表間空白」として検出
9. 空白帯の中央を譜表の区切り位置とし、Staff エンティティを生成

検出結果はユーザーがドラッグ操作で調整可能。

## PDF 組み立て

pdf-lib の `embedPage` を bounding box 付きで使用:

- ソース PDF のページから指定領域をベクターのまま切り出し
- ラスタライズしないため、テキスト選択やズームでの品質劣化なし
- A4 サイズの出力ページにセグメントを上から順に配置
- 収まらなければ自動改ページ

## テスト

```bash
npm test
```

**ユニットテスト**: 309 テスト（19 ファイル）、`src/core/` `src/workers/` `src/context/` のカバレッジ 100%:


- `staffModel.test.ts` - ラベル一括適用、パートグループ化、バリデーション（譜表数一致、ラベル完全性・重複・順序）
- `separatorModel.test.ts` - 区切り線の算出、ドラッグ、分割、結合、追加、任意位置での組段分割、組段のみの境界操作
- `geometry.test.ts` - 矩形の重なり判定、包含判定、クランプ
- `coordinateMapper.test.ts` - Canvas↔PDF 座標変換の往復一致
- `imageProcessing.test.ts` - グレースケール、二値化、水平投影
- `staffDetector.test.ts` - 合成投影データでの境界検出
- `systemDetector.test.ts` - 組段境界検出（ページ端拡張・複数組段）
- `projectionAnalysis.test.ts` - 空白帯検出・コンテンツ境界算出
- `pdfLoader.test.ts` - PDF ロード・レンダリング・キャンセル処理
- `partAssembler.test.ts` - PDF 生成、ページ分割、出力妥当性
- `zipExporter.test.ts` - ZIP 生成、ファイル構成、進捗コールバック
- `undoHistory.test.ts` - Undo/Redo 履歴管理
- `workerPool.test.ts` - Worker プールのタスク分配・終了処理・デフォルトサイズ
- `detectionPipeline.test.ts` - 検出パイプラインの結合テスト
- `detectionWorker.test.ts` - Worker メッセージハンドラ・エラー処理
- `projectReducer.test.ts` - projectReducer / combinedReducer / Undo・Redo
- `projectHooks.test.ts` - useProject / useProjectDispatch フック
- `projectContextDefs.test.ts` - 初期状態・コンテキスト定義
- `useCanvasDisplaySize.test.ts` - Canvas 表示サイズフック

**E2E テスト**: 21 テスト（7 ファイル）、デスクトップ (chromium) + モバイル (Pixel 5) の 2 プロジェクト構成:

- `import.spec.ts` - PDF アップロード・ドロップゾーン表示
- `detect.spec.ts` - 組段検出・境界操作
- `label.spec.ts` - ラベル入力・一括適用
- `export.spec.ts` - パートプレビュー・ダウンロード
- `full-flow.spec.ts` - 全ステップ通しフロー
- `mobile.spec.ts` - モバイルレスポンシブ（サイドレール非表示、ヘッダーステップ表示、ビューポート幅適合、ウィザード遷移）


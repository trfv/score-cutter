# Partifi Clone

総譜（フルスコア）PDF から個別のパート譜を自動抽出する Web アプリケーション。
[Partifi](http://partifi.org/) および [Divisi](https://divisi.hv-serve.com/) を参考に開発。

全ての処理がブラウザ内で完結するため、バックエンドサーバー不要。PDF がサーバーに送信されることはありません。

## 機能

- PDF 総譜のアップロード（ドラッグ＆ドロップ対応）
- 水平投影法による五線段の自動検出
- 組段（System）境界の手動編集（分割：ダブルクリック、結合：区切り線ダブルクリック / Delete キー、ドラッグ移動）
- 区切り線（Separator）のドラッグ操作・キーボード操作（Arrow キーで移動、Tab でフォーカス移動）による譜表境界の手動調整
- 譜表の追加（空白部分ダブルクリック）、分割（譜表上ダブルクリック）、結合（区切り線ダブルクリック）、削除
- 楽器名ラベル付け（オートコンプリート、1段目のパターンを全組段に一括適用）
- パート別 PDF 生成・ダウンロード（ベクター品質を保持）
- 全パート一括 ZIP ダウンロード
- Undo/Redo（Ctrl+Z / Ctrl+Y）
- Web Worker による並列検出処理
- 日本語・英語 UI 切替

## ワークフロー

```
1. インポート → 2. 組段 → 3. 譜表 → 4. ラベル → 5. プレビュー → 6. エクスポート
   PDF アップ    組段・譜表を  譜表境界を    楽器名を     パート構成     パート別 PDF
   ロード        自動検出     手動調整     割り当て     を確認         をダウンロード
```

## 技術スタック

| 用途 | ライブラリ |
|------|-----------|
| UI フレームワーク | React 19 + TypeScript |
| ビルドツール | Vite 7 |
| PDF レンダリング | pdfjs-dist 5 (pdf.js) |
| PDF 生成 | pdf-lib 1.17 |
| ZIP 生成 | JSZip |
| 多言語対応 | react-i18next |
| ID 生成 | uuid |
| テスト | Vitest + React Testing Library + jsdom |
| スタイリング | CSS Modules |

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
| `npm run test:watch` | テストをウォッチモードで実行 |
| `npm run lint` | ESLint 実行 |
| `npm run knip` | 未使用コード検出 |

## プロジェクト構成

```
src/
  core/                          # コアロジック（純粋関数、DOM 非依存）
    staffModel.ts                #   データ型定義 (Staff, Part, PageDimension)
    separatorModel.ts            #   区切り線モデル (Separator 算出、ドラッグ・分割・結合・追加)
    geometry.ts                  #   矩形演算ユーティリティ
    coordinateMapper.ts          #   Canvas ピクセル座標 ↔ PDF 座標 変換
    imageProcessing.ts           #   グレースケール / 二値化 / 水平投影
    staffDetector.ts             #   空白帯検出 → 譜表境界算出
    pdfLoader.ts                 #   pdf.js ラッパー（ロード・レンダリング）
    partAssembler.ts             #   pdf-lib でパート PDF を組み立て
    zipExporter.ts               #   全パート一括 ZIP 生成
    undoHistory.ts               #   Undo/Redo 履歴管理
    __tests__/                   #   コアロジックの単体テスト (9 ファイル)
  workers/                       # Web Worker 並列処理
    detectionPipeline.ts         #   検出パイプライン（画像処理→組段・譜表検出）
    detectionWorker.ts           #   Worker エントリーポイント
    workerPool.ts                #   Worker プール管理
    workerProtocol.ts            #   Worker 間メッセージ型定義
    __tests__/                   #   Worker の単体テスト (2 ファイル)
  components/                    # React コンポーネント（各 .tsx に対応する .module.css あり）
    ImportStep.tsx               #   PDF アップロード画面
    SystemStep.tsx               #   組段検出 + 組段境界の手動編集画面
    StaffStep.tsx                #   譜表境界の手動調整画面
    LabelStep.tsx                #   楽器名ラベル付け画面
    PreviewStep.tsx              #   パート構成プレビュー画面
    ExportStep.tsx               #   パート PDF ダウンロード画面
    PageCanvas.tsx               #   PDF ページの Canvas レンダリング
    SystemOverlay.tsx            #   組段境界の可視化 + 分割・結合・ドラッグ
    SeparatorOverlay.tsx         #   譜表区切り線の可視化 + ドラッグ・分割・結合・削除
    StaffOverlay.tsx             #   譜表領域のラベル色分け表示（Label ステップ用）
  hooks/                         # カスタムフック
    useUndoRedoKeyboard.ts       #   Ctrl+Z / Ctrl+Y キーボードショートカット
  context/                       # グローバル状態管理
    projectContextDefs.ts        #   型定義 (ProjectState, ProjectAction, WizardStep)
    ProjectContext.tsx            #   Provider + Reducer (useReducer + Undo/Redo)
    projectHooks.ts              #   カスタムフック (useProject, useProjectDispatch, useUndoRedo)
  i18n/
    ja.json                      # 日本語翻訳
    en.json                      # 英語翻訳
    index.ts                     # i18n 初期設定
  App.tsx                        # ウィザード UI + ステップインジケーター
  App.module.css                 # App レイアウトスタイル
  index.css                      # グローバルスタイル
  main.tsx                       # エントリーポイント
  test-setup.ts                  # Vitest テストセットアップ
```

## 五線検出アルゴリズム

水平投影法（Horizontal Projection）による組段・譜表検出:

1. PDF ページを 150 DPI で Canvas にレンダリング
2. ピクセルをグレースケールに変換 (`0.299R + 0.587G + 0.114B`)
3. 閾値 128 で二値化（黒=1, 白=0）
4. 各行の黒ピクセル数を集計（水平投影プロファイル）
5. 投影値が最大値の 5% 以下の行が 20px 以上連続する帯を「空白帯」として検出
6. 空白帯の中央を段の区切り位置とし、コンテンツのある領域をセグメントとして出力

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

120 テスト（11 ファイル）:

- `segmentModel.test.ts` - パートグループ化、ソート順
- `separatorModel.test.ts` - 区切り線の算出、ドラッグ、分割、結合、追加
- `geometry.test.ts` - 矩形の重なり判定、包含判定、クランプ
- `coordinateMapper.test.ts` - Canvas↔PDF 座標変換の往復一致
- `imageProcessing.test.ts` - グレースケール、二値化、水平投影
- `staffDetector.test.ts` - 合成投影データでの境界検出
- `partAssembler.test.ts` - PDF 生成、ページ分割、出力妥当性
- `zipExporter.test.ts` - ZIP 生成、ファイル構成、進捗コールバック
- `undoHistory.test.ts` - Undo/Redo 履歴管理
- `workerPool.test.ts` - Worker プールのタスク分配・終了処理
- `detectionPipeline.test.ts` - 検出パイプラインの結合テスト


# Score Cutter ユビキタス言語

## 楽譜ドメイン

| 用語 | 英語（コード） | 日本語 | 説明 | コード上の型・関数 |
|------|---------------|--------|------|-------------------|
| 譜表 | Staff | 譜表 | 1つの楽器の演奏記譜領域。ページ上の矩形で、top/bottom（PDF Y座標）で範囲を表す。ピアノの大譜表のように複数五線を含む場合もある。`systemId` で所属する System を参照する | `Staff` (`staffModel.ts`) |
| 組段 | System | 組段 | 全パートが縦に並んだ一括りを表す独立エンティティ（`{ id, pageIndex, top, bottom }`）。`ProjectState.systems` に格納される。Staff は `systemId` で所属する System を参照する。スコア1ページに通常1〜3段ある | `System` (`staffModel.ts`) |
| パート | Part | パート | 同じラベル（楽器名）の譜表を全ページ分まとめたもの。ページ順・組段順・位置順でソートされる | `Part` (`staffModel.ts`), `derivePartsFromStaffs()` |
| 楽器名 | Instrument / Label | 楽器名、ラベル | 譜表に付与する楽器の名前（例: Violin I, Cello）。パートの分類キー | `Staff.label` |
| 総譜 | Full Score / Source PDF | 総譜、フルスコア | ユーザーがインポートする元の楽譜PDF。全楽器が含まれる | `sourcePdfBytes` |
| パート譜 | Part Score | パート譜 | 抽出された個別楽器のPDF。アプリの最終出力 | `assemblePart()` の出力 |
| 区切り線 | Separator | 区切り線 | 譜表間（または譜表の上端・下端）に表示される水平線。ドラッグやキーボードで譜表サイズを変更可能。kind は `'edge'`（端）または `'part'`（譜表間）。キーボード操作: Tab でフォーカス、↑/↓ で移動（Shift で10px刻み）、Delete/Backspace でマージ/削除 | `Separator`, `SeparatorKind` (`separatorModel.ts`) |
| ページ寸法 | Page Dimension | ページ寸法 | PDFページの幅と高さ（ポイント単位） | `PageDimension` (`staffModel.ts`) |

## 検出・画像処理

| 用語 | 英語（コード） | 説明 | コード上の型・関数 |
|------|---------------|------|-------------------|
| 水平投影 | Horizontal Projection | 各行の黒ピクセル数の1D配列。譜表間の空白を検出する基本手法 | `horizontalProjection()` (`imageProcessing.ts`) |
| ギャップ | Gap | 投影値が閾値以下の連続行。譜表と譜表の間の空白を表す。`projectionAnalysis.ts` 内のモジュールプライベート型 | `findGaps()` (`projectionAnalysis.ts`) |
| 段組間ギャップ | System Gap | Systemを分離する大きな空白。デフォルト閾値50px | `minGapHeight` in `detectSystemBoundaries()` |
| パート間ギャップ | Part Gap | System内の譜表を分離する小さな空白。デフォルト閾値15px | `minPartGapHeight` in `detectStaffsInSystem()` |
| 組段境界 | System Boundary (Px) | 検出された組段の上端・下端のピクセル座標 | `SystemBoundaryPx` (`systemDetector.ts`) |
| 譜表境界 | Staff Boundary | 検出された譜表の上端・下端のピクセル座標 | `StaffBoundary` (`staffDetector.ts`) |
| コンテンツ境界 | Content Bounds | 投影データ中の最初・最後のコンテンツ行の位置 | `findContentBounds()` (`projectionAnalysis.ts`) |
| 二値化 | Binarization | グレースケール画像を白黒（0/1）に変換する前処理。閾値128 | `toBinary()` (`imageProcessing.ts`) |
| グレースケール | Grayscale | RGBA → 輝度への変換（Rec.601 係数: 0.299R + 0.587G + 0.114B） | `toGrayscale()` (`imageProcessing.ts`) |
| 検出パイプライン | Detection Pipeline | Phase 1（SystemStep）: RGBA → グレースケール → 二値化 → 水平投影 → 組段ギャップ検出 → System エンティティ。Phase 2（StaffStep）: System ごとにパートギャップ検出 → Staff オブジェクト | `runSystemDetection()`, `runStaffDetection()` (`detectionPipeline.ts`) |

## 座標系

| 用語 | 英語（コード） | 説明 | コード上の型・関数 |
|------|---------------|------|-------------------|
| PDF Y 座標 | PDF Y | 原点が左下。上ほど値が大きい | `pdfYToCanvasY()` |
| Canvas Y 座標 | Canvas Y | 原点が左上。下ほど値が大きい | `canvasYToPdfY()` |
| スケール | Scale | DPI / 72。PDF座標とピクセルの変換係数。検出・表示ともに150 DPI（≈ 2.08倍） | `getScale()` (`coordinateMapper.ts`) |

## ワークフロー（ウィザードステップ）

| ステップ | 英語 | 日本語 | 処理内容 |
|----------|------|--------|----------|
| Import | Import | インポート | PDF ファイルの読み込み。ページ数・寸法を取得 |
| Systems | Systems | 組段検出 | 画像処理による組段の自動検出。手動での分割・結合・境界調整 |
| Staffs | Staffs | 譜表検出 | 組段内の譜表の自動検出。手動での追加・削除・分割・境界調整 |
| Label | Label | ラベル | 各譜表に楽器名を付与。「全組段に適用」で一括ラベリング |
| Export | Export | エクスポート | パート譜PDFのプレビュー表示、個別ダウンロードまたはZIP一括ダウンロード |

`WizardStep` 型: `'import' | 'systems' | 'staffs' | 'label' | 'export'` (`projectContextDefs.ts`)

## 区切り線操作（separatorModel.ts）

### Staff + System 原子操作

staffs と systems の両方を原子的に更新し `{ staffs, systems }` を返す関数群:

| 関数 | 説明 |
|------|------|
| `splitSystemAtGap()` | 隣接する2つの譜表間のギャップで組段を分割 |
| `mergeAdjacentSystems()` | 隣接する2つの組段を結合し、譜表を上の組段に再割り当て |
| `reassignStaffsByDrag()` | ドラッグ位置に基づき組段間で譜表を再割り当て |
| `splitSystemAtPosition()` | 任意のPDF Y位置で組段を分割（ギャップ、境界付近、譜表内を自動判定） |
| `addStaffAtPosition()` | 任意のPDF Y位置に新しい譜表を追加 |

### System のみ操作

System[] のみを変更し、staffs には触れない関数群:

| 関数 | 説明 |
|------|------|
| `dragSystemBoundary()` | 組段境界をドラッグ移動 |
| `splitSystemAtPdfY()` | PDF Y位置で System エンティティを分割 |
| `mergeAdjacentSystemsOnly()` | 隣接する2つの System エンティティを結合 |

### Staff レベル操作

| 関数 | 説明 |
|------|------|
| `applySeparatorDrag()` | 譜表間の区切り線をドラッグして top/bottom を調整 |
| `splitStaffAtPosition()` | 1つの譜表を PDF Y位置で上下に分割 |
| `mergeSeparator()` | 隣接する2つの譜表をマージ（区切り線を削除） |

## バリデーション

| 用語 | 英語（コード） | 説明 | コード上の型・関数 |
|------|---------------|------|-------------------|
| バリデーション重要度 | Validation Severity | `'success'` または `'warning'` | `ValidationSeverity` (`staffModel.ts`) |
| バリデーションメッセージ | Validation Message | i18nキーベースのメッセージ。severity と messageKey（+ オプションの messageParams）を持つ | `ValidationMessage` (`staffModel.ts`) |
| 譜表数整合性チェック | Staff Count Consistency | 全組段で譜表数が同じかを検証（StaffStep で表示） | `validateStaffCountConsistency()`, `getStaffStepValidations()` |
| ラベル完全性チェック | Label Completeness | 未ラベルの譜表がないかを検証 | `validateLabelCompleteness()`, `getLabelStepValidations()` |
| ラベル重複チェック | Duplicate Label Detection | 同一組段内でラベルが重複していないかを検証 | `validateDuplicateLabelsInSystems()` |
| ラベル順序整合性チェック | Label Order Consistency | 全組段でラベルの順序が一致しているかを検証 | `validateLabelConsistency()` |

## PDF組版

| 用語 | 英語（コード） | 説明 | コード上の型・関数 |
|------|---------------|------|-------------------|
| 組版 | Assembly | 抽出した譜表を新しいPDFに配置する処理。pdf-lib の `embedPage()` でベクタ品質を保持 | `assemblePart()` (`partAssembler.ts`) |
| 組版オプション | Assembly Options | 出力PDFのページサイズ（A4: 595×842pt）、余白（36pt）、譜表間隔（18pt） | `AssemblyOptions`, `defaultAssemblyOptions` |
| 譜表間隔 | Gap Between Staffs | 出力PDF上で譜表と譜表の間に入れるスペース | `gapBetweenStaffs` |
| ZIP エクスポート | ZIP Export | 全パート譜を1つの ZIP にバンドルして一括ダウンロード。進捗コールバック付き | `zipParts()` (`zipExporter.ts`), `ZipProgress` |

## 状態管理

| 用語 | 英語（コード） | 説明 |
|------|---------------|------|
| プロジェクト状態 | ProjectState | アプリ全体の状態。step, sourcePdfBytes, pdfDocument, pageCount, pageDimensions, staffs, systems, currentPageIndex を保持 |
| 元に戻す / やり直す | Undo / Redo | 譜表・組段の変更を最大50手まで記録。`UndoHistory<T>` ジェネリック型で実装 |
| アンドゥ可能アクション | Undoable Actions | SET_STAFFS, SET_STAFFS_AND_SYSTEMS, SET_SYSTEMS, UPDATE_STAFF, ADD_STAFF, DELETE_STAFF の6種。Undo/Redo の対象 |
| アンドゥスナップショット | Undoable Snapshot | `{ staffs: Staff[]; systems: System[] }` — staffs と systems を原子的に保持するスナップショット。Undo/Redo はこの単位で復元する | `UndoableSnapshot` (`ProjectContext.tsx`) |
| 結合状態 | Combined State | `{ project: ProjectState; history: UndoHistory<UndoableSnapshot> }` — Reducer が管理する結合状態 | `CombinedState` (`ProjectContext.tsx`) |

## UI コンポーネント（ドメイン用語）

| 用語 | 英語（コード） | 説明 |
|------|---------------|------|
| ステップツールバー | StepToolbar | 全ステップ（Import 以外）共通のトップバー。前後移動 + ページナビゲーション + ステップ固有アクション |
| ステータスインジケーター | StatusIndicator | `ValidationMessage[]` をツールバー中央に表示。success（チェックアイコン）/ warning（三角アイコン）|
| システムオーバーレイ | SystemOverlay | SystemStep 用の SVG/div オーバーレイ。色付き組段矩形と組段間の区切り線を表示 |
| セパレーターオーバーレイ | SeparatorOverlay | StaffStep 用のオーバーレイ。組段背景帯・譜表領域・区切り線を表示。LabelStep では `dragOnly` で視覚のみ |
| ページキャンバス | PageCanvas | pdfjs-dist で1ページを `<canvas>` に描画するコンポーネント |
| ヘルプパネル | HelpPanel | "?" ボタンで開くモーダル。i18n の `help.{step}.tips` からステップ別ヒントを表示 |

## ジオメトリユーティリティ（geometry.ts）

| 関数 | 説明 |
|------|------|
| `rectsOverlap(a, b)` | 2つの矩形が重なるか判定（PDF Y 座標系: top > bottom） |
| `rectContains(outer, inner)` | inner が outer に完全に含まれるか判定 |
| `clampValue(value, min, max)` | 値を [min, max] にクランプ |
| `staffHeight(staff)` | `staff.top - staff.bottom` を返す |

## ドメイン補助関数（staffModel.ts）

| 関数 | 説明 |
|------|------|
| `getPageSystems(systems, pageIndex)` | 指定ページの System を top 降順でフィルタ・ソート |
| `getSystemOrdinal(systems, pageIndex, systemId)` | ページ内での System の序数位置（0始まり）を返す |
| `buildSystemOrdinalMap(systems, pageIndex)` | systemId → 序数位置の Map を構築 |
| `staffsMatchSystems(staffs, systems)` | 全 Staff が有効な systemId を参照しているか検証 |
| `applySystemLabelsToAll(staffs, templateSystemId)` | テンプレート System のラベルを序数位置ベースで全 System にコピー |
| `derivePartsFromStaffs(staffs, systems?)` | ラベル付き Staff を Part に集約（ページ順・組段順・位置順） |

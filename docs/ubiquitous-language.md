# Score Cutter ユビキタス言語

## 楽譜ドメイン

| 用語 | 英語（コード） | 日本語 | 説明 | コード上の型・関数 |
|------|---------------|--------|------|-------------------|
| 譜表 | Staff | 譜表 | 1つの楽器の演奏記譜領域。ページ上の矩形で、top/bottom（PDF Y座標）で範囲を表す。ピアノの大譜表のように複数五線を含む場合もある | `Staff` (`staffModel.ts`) |
| 組段 | System | 組段 | 全パートが縦に並んだ一括りを表す独立エンティティ（`{ id, pageIndex, top, bottom }`）。`ProjectState.systems` に格納される。Staff は `systemId` で所属する System を参照する。スコア1ページに通常1〜3段ある | `System` (`staffModel.ts`), `SystemBoundary` (`staffDetector.ts`) |
| パート | Part | パート | 同じ楽器の譜表を全ページ分まとめたもの。label（楽器名）で紐づく | `Part` (`staffModel.ts`) |
| 楽器名 | Instrument / Label | 楽器名、ラベル | 譜表に付与する楽器の名前（例: Violin I, Cello）。パートの分類キー | `Staff.label`, `COMMON_INSTRUMENTS` |
| 総譜 | Full Score / Source PDF | 総譜、フルスコア | ユーザーがインポートする元の楽譜PDF。全楽器が含まれる | `sourcePdfBytes` |
| パート譜 | Part Score | パート譜 | 抽出された個別楽器のPDF。アプリの最終出力 | `assemblePart()` の出力 |
| 区切り線 | Separator | 区切り線 | 譜表間（または譜表の上端・下端）に表示される水平線。ドラッグで譜表サイズを変更可能。kind は 'edge'（端）または 'part'（譜表間） | `Separator` (`separatorModel.ts`) |

## 検出・画像処理

| 用語 | 英語（コード） | 説明 | コード上の型・関数 |
|------|---------------|------|-------------------|
| 水平投影 | Horizontal Projection | 各行の黒ピクセル数の1D配列。譜表間の空白を検出する基本手法 | `horizontalProjection()` (`imageProcessing.ts`) |
| ギャップ | Gap | 投影値が閾値以下の連続行。譜表と譜表の間の空白を表す | `Gap` (`staffDetector.ts`) |
| 段組間ギャップ | System Gap | Systemを分離する大きな空白。デフォルト閾値50px | `minSystemGapHeight` |
| パート間ギャップ | Part Gap | System内の譜表を分離する小さな空白。デフォルト閾値15px | `minPartGapHeight` |
| 譜表境界 | Staff Boundary | 検出された譜表の上端・下端のピクセル座標 | `StaffBoundary` (`staffDetector.ts`) |
| 二値化 | Binarization | グレースケール画像を白黒（0/1）に変換する前処理。閾値128 | `toBinary()` (`imageProcessing.ts`) |
| 検出パイプライン | Detection Pipeline | RGBA → グレースケール → 二値化 → 水平投影 → ギャップ検出 → 境界決定 の一連の処理 | `runDetectionPipeline()` (`detectionPipeline.ts`) |

## 座標系

| 用語 | 英語（コード） | 説明 | コード上の型・関数 |
|------|---------------|------|-------------------|
| PDF Y 座標 | PDF Y | 原点が左下。上ほど値が大きい | `pdfYToCanvasY()` |
| Canvas Y 座標 | Canvas Y | 原点が左上。下ほど値が大きい | `canvasYToPdfY()` |
| スケール | Scale | DPI / 72。PDF座標とピクセルの変換係数。検出・表示ともに150 DPI（≈ 2.08倍） | `getScale()` (`coordinateMapper.ts`) |
| ページ寸法 | Page Dimension | PDFページの幅と高さ（ポイント単位） | `PageDimension` (`staffModel.ts`) |

## ワークフロー（ウィザードステップ）

| ステップ | 英語 | 日本語 | 処理内容 |
|----------|------|--------|----------|
| Import | Import | インポート | PDF ファイルの読み込み。ページ数・寸法を取得 |
| Detect | Detect | 検出 | 画像処理による譜表の自動検出。手動での追加・削除・境界調整 |
| Label | Label | ラベル | 各譜表に楽器名を付与。「全組段に適用」で一括ラベリング |
| Preview | Preview | プレビュー | パート単位で譜表の一覧を確認 |
| Export | Export | エクスポート | パート譜PDFの個別ダウンロードまたはZIP一括ダウンロード |

## PDF組版

| 用語 | 英語（コード） | 説明 | コード上の型・関数 |
|------|---------------|------|-------------------|
| 組版 | Assembly | 抽出した譜表を新しいPDFに配置する処理 | `assemblePart()` (`partAssembler.ts`) |
| 組版オプション | Assembly Options | 出力PDFのページサイズ（A4）、余白（36pt）、譜表間隔（18pt） | `AssemblyOptions`, `defaultAssemblyOptions` |
| 譜表間隔 | Gap Between Staffs | 出力PDF上で譜表と譜表の間に入れるスペース | `gapBetweenStaffs` |

## 状態管理

| 用語 | 英語（コード） | 説明 |
|------|---------------|------|
| プロジェクト状態 | ProjectState | アプリ全体の状態。現在のステップ、PDF、譜表一覧、ページ番号を保持 |
| 元に戻す / やり直す | Undo / Redo | 譜表の変更（追加・削除・更新・一括設定）を最大50手まで記録 |
| 譜表アクション | Undoable Actions | SET_STAFFS, SET_STAFFS_AND_SYSTEMS, UPDATE_STAFF, ADD_STAFF, DELETE_STAFF の5種。Undo/Redo の対象。スナップショットは staffs と systems の両方を原子的に保持 |

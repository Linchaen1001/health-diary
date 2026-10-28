# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

健康スコア日記: 毎日の生活習慣を採点し、100点満点の総合スコアと Gemini のフィードバックを返す Web アプリ。UI・エラーメッセージ・コメントはすべて日本語。

## アーキテクチャ

独立して起動する3つのサービス構成(ルートに package.json はなく、git リポジトリでもない)。

```
client (React/Vite :5173) → server (Express 5 + node:sqlite :3001) → python-api (FastAPI :8000) → Gemini
```

- **client/**: Vite の dev サーバーが `/api` を :3001 へプロキシする。ページは `src/pages`、API ラッパーは `src/api.js`、認証コンテキストは `src/auth.jsx`。
- **server/**: ユーザー、認証(JWT + bcryptjs)、ユーザーごとの採点項目、`logs` テーブルを SQLite(`health.db`)で管理する。組み込みの `node:sqlite` を使うため Node 22.5 以上が必要(ネイティブビルド不要)。`app.js` は `db` / `python` クライアント / `now()` を注入して組み立てるので、テストでは差し替えられる(`test/helpers.js` 参照)。ルートは `auth` / `logs` / `settings`。
- **python-api/**: ステートレス。`POST /internal/evaluate` が純粋関数の採点(`app/scoring.py`)を行い、その後フィードバックを生成する(`app/llm.py`)。`X-Internal-Token` ヘッダーが `INTERNAL_TOKEN` と一致する場合のみ受け付ける(`server/.env` と `python-api/.env` で同じ値にすること)。`GEMINI_API_KEY` が未設定・プレースホルダのまま・呼び出し失敗のときは、ルールベースの定型コメントに切り替わり `feedback_source: "fallback"` を返す(採点結果自体は常に返る)。モデルは `GEMINI_MODEL` で変更可能(既定 `gemini-3.8-flash`)。

### 主な流れ: `POST /api/logs`
`routes/logs.js` がユーザーの**有効な**項目を読み込む → 回答を検証(`services/validate.js`) → 重みを付与 → Python の `evaluate` を呼ぶ → `logs` に `(user_id, date)` キーで upsert(同日の再送信は上書き)。Python が 422 を返したら client へは 400、それ以外の Python 障害は 502。

### 複数ファイルにまたがる注意点
- **重みは保存せず、取得のたびに計算する**: `services/items.js` の `listItems` が、有効項目へ合計がちょうど100になるよう毎回按分する(余りは先頭項目から +1)。同じアルゴリズムが `python-api/app/scoring.py::allocate_weights` にもあり(server 側は `services/weights.js`)、Python は重み合計が100でないリクエストを拒否する。両実装は同期させること。
- **項目タイプ**(`bool, scale3, scale5, water, steps, time`)は複数箇所で定義されている: server の `validate.js` / `presets.js`、Python の `scoring.py`(`normalize` と `ITEM_TYPES`。`schemas.py` はそこから参照)、client の `ItemInput.jsx`。タイプを追加するときは全て更新が必要。回答値の検証規則(範囲など)は `validate.js` と `scoring.py` で重複しているので、変更時は両方を揃える。
- **日付は日本時間(Asia/Tokyo)基準**(`routes/logs.js` の `tokyoDate`)。サーバーのローカル時刻ではない。
- 自由記述は 1000 文字まで(server と `schemas.py` の両方で制限)。`llm.py` ではプロンプト内の `<user_note>` タグで「ユーザーデータ」として分離し、中の指示には従わせない(プロンプトインジェクション対策)。

## コマンド

セットアップ手順は README.md を参照(Python は `python-api/.venv`、`python-api` と `server` で `.env.example` を `.env` にコピー、`GEMINI_API_KEY` は `python-api/.env` に記入)。

```powershell
# python-api
cd python-api; .\.venv\Scripts\uvicorn app.main:app --port 8000
.\.venv\Scripts\python -m pytest                                  # 全テスト
.\.venv\Scripts\python -m pytest tests/test_scoring.py -k water   # 単体

# server
cd server; npm start            # 開発時は npm run dev(watch)
npm test
node --no-warnings --test test/logs.test.js                                   # 1ファイル
node --no-warnings --test --test-name-pattern="regex" test/logs.test.js       # 名前で絞る

# client
cd client; npm run dev          # npm run build で dist/ を生成
npm test                        # vitest run
npx vitest run src/app.test.jsx -t "テスト名"
```

リンターは設定されていない。

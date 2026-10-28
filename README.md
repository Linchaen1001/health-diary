# 健康スコア日記

毎日の生活習慣を採点し、100点満点の総合スコアと Gemini のフィードバックを返す Web アプリ。

```
React(client:5173) → Node.js/Express(server:3001, SQLite) → Python/FastAPI(python-api:8000) → Gemini API
```

## セットアップ

### 1. Python API (採点 + Gemini)
```powershell
cd python-api
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
copy .env.example .env      # ← .env を開いて GEMINI_API_KEY を入力
.\.venv\Scripts\uvicorn app.main:app --port 8000
```
**Gemini APIキーの入力箇所: `python-api/.env` の `GEMINI_API_KEY`**
(未設定・失敗時はルールベースの簡易コメントで動作し、画面に注記が出ます)

### 2. Node.js サーバー (Node 22.5 以上。`node:sqlite` を使うためネイティブビルド不要)
```powershell
cd server
npm install
copy .env.example .env      # JWT_SECRET を任意の長い文字列に。INTERNAL_TOKEN は python-api/.env と同じ値に
npm start
```

### 3. フロントエンド
```powershell
cd client
npm install
npm run dev                 # http://localhost:5173 (/api は 3001 へプロキシ)
```

## テスト
```powershell
cd python-api; .\.venv\Scripts\python -m pytest     # 84件
cd server;     npm test                              # 71件
cd client;     npm test                              # 47件
```
各テストは正常系・異常系・境界値(水分/歩数/段階評価の上下限、起床時刻差、重み按分 N=1〜100、パスワード長、自由記述1000/1001文字、週/月の日付境界、追加項目の上限など)を含みます。

## 仕様メモ
- 採点: 各項目を0〜1に正規化し、有効項目へ合計が厳密に100となる重みを按分(余りは先頭項目から+1点)。項目の追加・無効化・削除のたびに再按分。
- 起床時間: 目標時刻との差0分=満点、60分以上=0点(線形)。水分: 1.5Lで満点。歩数: 8000歩で満点。
- 日付は日本時間(Asia/Tokyo)基準。同じ日に再送信すると上書き。
- Python API は `X-Internal-Token` が一致する Node からのみ呼べます。
- 自由記述はプロンプト内で「ユーザーデータ」として分離し、1000文字まで。

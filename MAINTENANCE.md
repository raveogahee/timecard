# タイムカード勤怠管理システム — 保守管理ガイド

最終更新: 2026-03-08

---

## 1. システム概要

Next.js 16 + Supabase で構築されたWebベースのタイムカード管理システム。

| 要素 | 技術 |
|------|------|
| フロントエンド | React 19 + Tailwind CSS v4 |
| バックエンド | Next.js API Routes |
| データベース | Supabase (PostgreSQL) |
| 認証 | bcrypt + sessionStorage |
| テスト | Jest + ts-jest |

---

## 2. ディレクトリ構成

```
src/
├── __tests__/                        # テストファイル
│   ├── worktime.test.ts              #   労働時間計算テスト (24件)
│   └── fetchWithRetry.test.ts        #   リトライ機能テスト (8件)
├── app/
│   ├── page.tsx                      # 打刻画面（メイン）
│   ├── layout.tsx                    # ルートレイアウト
│   ├── globals.css                   # グローバルスタイル
│   ├── admin/
│   │   └── page.tsx                  # 管理画面（認証付き）
│   └── api/
│       ├── employees/route.ts        # 従業員 CRUD
│       ├── reports/route.ts          # 月次レポート・CSV出力
│       ├── auth/
│       │   ├── verify/route.ts       # パスワード検証
│       │   └── change-password/route.ts # パスワード変更
│       └── attendance/
│           ├── route.ts              # 勤怠一覧・編集・削除
│           ├── clock-in/route.ts     # 出勤打刻
│           ├── clock-out/route.ts    # 退勤打刻
│           ├── status/route.ts       # 勤務状態確認
│           └── today/route.ts        # 本日の記録取得
├── lib/
│   ├── supabase.ts                   # Supabaseクライアント初期化
│   ├── worktime.ts                   # 労働時間計算・休憩ルール
│   └── fetchWithRetry.ts            # リトライ付きfetchユーティリティ
└── types/
    └── index.ts                      # 型定義 (Employee, Attendance, PunchLog)
```

---

## 3. 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 必須 | SupabaseプロジェクトのURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 必須 | Supabaseの匿名キー |
| `ADMIN_PASSWORD` | 必須 | 管理画面の初期パスワード（DB設定後はフォールバック用） |

---

## 4. データベーススキーマ

### employees テーブル

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID (PK) | 自動生成 |
| name | VARCHAR(100) | 従業員名 |
| is_active | BOOLEAN | 有効/無効（論理削除用） |
| created_at | TIMESTAMPTZ | 作成日時 |
| updated_at | TIMESTAMPTZ | 更新日時 |

### attendance テーブル

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID (PK) | 自動生成 |
| employee_id | UUID (FK) | 従業員ID |
| work_date | DATE | 勤務日 |
| shift_number | INTEGER | シフト番号（同日複数勤務対応） |
| clock_in | TIMESTAMPTZ | 出勤時刻 |
| clock_out | TIMESTAMPTZ | 退勤時刻（null=勤務中） |
| break_minutes | INTEGER | 休憩時間（分） |
| work_minutes | INTEGER | 労働時間（分） |
| is_overnight | BOOLEAN | 日跨ぎフラグ |
| status | VARCHAR(20) | `working` / `completed` |
| note | TEXT | 備考（残業申請等） |

### settings テーブル

| カラム | 型 | 説明 |
|--------|-----|------|
| key | VARCHAR(255) (PK) | 設定キー |
| value | TEXT | 設定値 |

現在使用中のキー: `admin_password_hash`（bcryptハッシュ）

### punch_log テーブル（監査用）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID (PK) | 自動生成 |
| employee_id | UUID (FK) | 従業員ID |
| punch_type | VARCHAR(20) | `clock_in` / `clock_out` |
| punch_time | TIMESTAMPTZ | 打刻時刻 |

SQL定義ファイルは `sql/` ディレクトリに格納。

---

## 5. APIエンドポイント一覧

### 打刻系

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/attendance/clock-in` | 出勤打刻 |
| POST | `/api/attendance/clock-out` | 退勤打刻（残業申請対応） |
| GET | `/api/attendance/status` | 勤務状態確認 |
| GET | `/api/attendance/today` | 本日の勤務記録取得 |

### 管理系

| メソッド | パス | 説明 |
|----------|------|------|
| GET/PUT/DELETE | `/api/attendance` | 勤怠記録の一覧・編集・削除 |
| GET/POST/PUT/DELETE | `/api/employees` | 従業員の一覧・追加・編集・削除 |
| GET | `/api/reports` | 月次レポート（JSON/CSV） |
| POST | `/api/auth/verify` | パスワード検証 |
| POST | `/api/auth/change-password` | パスワード変更 |

---

## 6. ビジネスロジック

### 休憩時間の自動計算 (`lib/worktime.ts`)

| 実労働時間 | 休憩 | 備考 |
|-----------|------|------|
| 6時間未満 | 0分 | — |
| 6時間〜6時間14分 | 0分 | 労働時間は6時間に固定 |
| 6時間15分〜7時間59分 | 45分 | — |
| 8時間以上 | 60分 | — |

### 日跨ぎ判定
退勤時刻が出勤時刻より前の場合、翌日とみなし +24時間で計算。

### 連続打刻防止
出勤・退勤後5秒間のクールダウンで誤操作を防止。

### 残業申請
退勤時に15分〜3時間（15分単位）で残業時間を申請可能。noteフィールドに「残業XX分」と記録。

---

## 7. エラー耐性（リトライ機構）

### fetchWithRetry (`lib/fetchWithRetry.ts`)

フロントエンドの全fetch呼び出し（5箇所）にリトライ機構を適用。

| 設定 | デフォルト値 |
|------|-------------|
| 最大リトライ回数 | 2回（合計3回試行） |
| リトライ間隔 | 500ms → 1000ms（指数バックオフ） |

| エラー種別 | リトライ | 理由 |
|-----------|---------|------|
| ネットワークエラー（fetch例外） | する | 一時的な接続障害の可能性 |
| 500系サーバーエラー | する | サーバー側の一時的障害 |
| 400系クライアントエラー | しない | リクエスト内容の問題（再送しても同結果） |

### 各画面でのエラーハンドリング方針

| 箇所 | 失敗時の挙動 |
|------|-------------|
| 従業員一覧取得 | エラーメッセージを表示（「ページを再読み込みしてください」） |
| 勤務状態取得 | 前回の状態を維持（安全側に倒す） |
| 本日の記録取得 | console.errorのみ（打刻機能に影響しない） |
| 出勤・退勤打刻 | ネットワーク/サーバーエラーを区別してメッセージ表示 |

---

## 8. 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# 本番サーバー起動
npm run start

# テスト実行
npm test

# テスト監視モード
npm run test:watch

# リント
npm run lint

# TypeScript型チェック
npx tsc --noEmit
```

---

## 9. テスト

### テストファイルと件数

| ファイル | 件数 | 対象 |
|----------|------|------|
| `worktime.test.ts` | 24件 | 労働時間計算、休憩ルール、フォーマット |
| `fetchWithRetry.test.ts` | 8件 | リトライロジック、エラー分類 |

### テスト実行時の注意点
- テスト環境: Node.js（`testEnvironment: 'node'`）
- パスエイリアス `@/` は `moduleNameMapper` で解決
- fetchWithRetryテストではグローバル `fetch` をモック化

---

## 10. デプロイ時の確認事項

### 必須チェック
- [ ] 環境変数 3件がすべて設定されていること
- [ ] `npx tsc --noEmit` でTypeScriptエラーがないこと
- [ ] `npm test` で全テストがパスすること
- [ ] Supabase上に4テーブル（employees, attendance, punch_log, settings）が存在すること
- [ ] settingsテーブルのRLSが適切に設定されていること

### Supabase RLS
settingsテーブルは全操作を許可するRLSポリシーを設定（アプリレベルで制御）。
他のテーブルも同様にアプリレベルでアクセス制御している点に注意。

---

## 11. よくある保守作業

### 従業員の追加・無効化
管理画面（`/admin`）の「従業員管理」タブから操作。無効化は論理削除（`is_active=false`）。

### 打刻ミスの修正
管理画面の「勤怠記録」タブで記録を検索し、編集ボタンから出勤・退勤時刻を修正。労働時間は自動再計算される。

### 管理パスワードの変更
管理画面ログイン後、画面上部の「パスワード変更」ボタンから変更。変更後はDBのsettingsテーブルにbcryptハッシュで保存される。

### 月次データのエクスポート
管理画面の「月次レポート」タブで年月を選択し、「CSV出力」ボタンでダウンロード。

### テストデータの投入
`sql/test_data_simple.sql` または `sql/test_data.sql` をSupabase SQL Editorで実行。

---

## 12. トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| 画面に「従業員情報の取得に失敗しました」 | Supabase接続エラー or 環境変数未設定 | 環境変数とSupabaseの稼働状況を確認 |
| 出勤ボタンが押せない（グレーアウト） | 従業員未選択 or クールダウン中 | 従業員を選択し、5秒待つ |
| 勤務中なのに「未出勤」と表示される | status APIの取得失敗 | ページを再読み込み（リトライで自動回復する場合あり） |
| ビルドエラー `supabaseUrl is required` | 環境変数 `NEXT_PUBLIC_SUPABASE_URL` が未設定 | `.env.local` に設定を追加 |
| 管理画面にログインできない | パスワード不一致 | DB settings テーブルの `admin_password_hash` を確認、または環境変数 `ADMIN_PASSWORD` を確認 |
| CSV出力が文字化けする | エンコーディングの問題 | BOM付きUTF-8で出力済み。Excel側の設定を確認 |

---

## 13. 今後の拡張時の注意点

- **新規APIルート追加時**: `src/app/api/` 以下にディレクトリを作成し `route.ts` を配置。日本時間（JST = UTC+9）の処理に注意。
- **新規fetch呼び出し追加時**: `fetchWithRetry` を使用すること。400系エラーはリトライされないため、クライアントエラーの区別は呼び出し側で行う。
- **休憩ルール変更時**: `lib/worktime.ts` の `calculateWorkTime` を修正し、`worktime.test.ts` にテストケースを追加。
- **テーブル追加時**: `src/types/index.ts` に型定義を追加。SQLファイルは `sql/` に配置。
- **認証方式変更時**: 現在はsessionStorage（タブ単位）。永続化する場合はcookieベースへの変更を検討。

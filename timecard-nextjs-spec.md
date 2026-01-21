# タイムカード管理システム設計書
## Next.js + Supabase版

## 概要
Next.js + Supabaseで構築するWebベースのタイムカード管理システム。
Claude Codeで開発し、Vercelにデプロイする。

---

## 技術スタック

| レイヤー | 技術 | 用途 |
|---------|------|------|
| フロントエンド | Next.js 14 (App Router) | UI・ページ |
| スタイリング | Tailwind CSS | デザイン |
| バックエンド | Next.js API Routes | APIエンドポイント |
| データベース | Supabase (PostgreSQL) | データ保存 |
| 認証 | 簡易パスワード認証 | 管理画面保護 |
| デプロイ | Vercel | ホスティング |

---

## 認証方式

```
┌─────────────────────────────────────────────────┐
│ 打刻画面（パスワード不要）                        │
│ - 従業員をドロップダウンで選択                    │
│ - 出勤/退勤ボタンを押すだけ                      │
│ - 本日の選択従業員の勤務状況を確認               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 管理画面（パスワード必要）                        │
│ - 従業員の追加・編集・削除                       │
│ - 勤怠記録の編集・削除                          │
│ - 月次レポート・CSV出力                         │
│ - 全従業員の勤務状況一覧                        │
└─────────────────────────────────────────────────┘
```

| 画面 | アクセス | できること |
|------|---------|-----------|
| /（打刻画面） | 誰でもOK | 打刻、本日の記録閲覧 |
| /admin（管理画面） | パスワード必要 | 従業員管理、記録編集/削除、レポート、CSV出力 |

※パスワードは環境変数 `ADMIN_PASSWORD` で管理

---

## データベース設計（Supabase）

### テーブル1: employees（従業員）
```sql
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### テーブル2: attendance（勤怠記録）
```sql
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  shift_number INTEGER DEFAULT 1,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  break_minutes INTEGER DEFAULT 0,
  work_minutes INTEGER DEFAULT 0,
  is_overnight BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'working', -- 'working' | 'completed'
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX idx_attendance_work_date ON attendance(work_date);
CREATE INDEX idx_attendance_status ON attendance(status);
```

### テーブル3: punch_log（打刻ログ）
```sql
CREATE TABLE punch_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  punch_type VARCHAR(20) NOT NULL, -- 'clock_in' | 'clock_out'
  punch_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## ディレクトリ構成

```
timecard/
├── app/
│   ├── layout.tsx              # 共通レイアウト
│   ├── page.tsx                # 打刻画面（トップ）
│   ├── admin/
│   │   ├── page.tsx            # 管理画面
│   │   └── layout.tsx          # 管理画面レイアウト（認証チェック）
│   └── api/
│       ├── employees/
│       │   └── route.ts        # 従業員CRUD
│       ├── attendance/
│       │   ├── route.ts        # 勤怠記録CRUD
│       │   ├── clock-in/
│       │   │   └── route.ts    # 出勤打刻
│       │   └── clock-out/
│       │       └── route.ts    # 退勤打刻
│       ├── reports/
│       │   └── route.ts        # レポート生成
│       └── auth/
│           └── verify/
│               └── route.ts    # 管理パスワード検証
├── components/
│   ├── Clock.tsx               # リアルタイム時計
│   ├── EmployeeSelect.tsx      # 従業員選択
│   ├── PunchButton.tsx         # 打刻ボタン
│   ├── TodayRecords.tsx        # 本日の記録
│   ├── StatusBadge.tsx         # ステータス表示
│   ├── Toast.tsx               # トースト通知
│   ├── AdminAuth.tsx           # 管理画面認証モーダル
│   ├── EmployeeManager.tsx     # 従業員管理
│   ├── RecordEditor.tsx        # 記録編集
│   └── MonthlyReport.tsx       # 月次レポート
├── lib/
│   ├── supabase.ts             # Supabaseクライアント
│   ├── utils.ts                # ユーティリティ関数
│   └── worktime.ts             # 労働時間計算ロジック
├── types/
│   └── index.ts                # TypeScript型定義
├── .env.local                  # 環境変数
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 機能詳細

### 1. 打刻機能（/）

**出勤打刻：**
- 従業員を選択して「出勤」ボタン
- 新規attendanceレコード作成（status: 'working'）
- 同日に既存レコードがあればshift_numberをインクリメント
- 前日の未退勤チェック → 警告表示

**退勤打刻：**
- 「退勤」ボタンでclock_outを記録
- 日跨ぎ判定（clock_out < clock_in → is_overnight = true、翌日0時以降として計算）
- 労働時間・休憩時間を自動計算
- status = 'completed'

**連続打刻防止：**
- 最後の打刻から5秒以内は打刻不可

**表示：**
- 現在時刻（1秒ごと更新）
- 選択中従業員の勤務状況
- 本日の勤務履歴

### 2. 労働時間計算ロジック

```typescript
// lib/worktime.ts

export function calculateWorkTime(clockIn: Date, clockOut: Date): {
  workMinutes: number;
  breakMinutes: number;
  isOvernight: boolean;
} {
  let totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
  
  // 日跨ぎ対応（マイナスなら翌日扱い）
  const isOvernight = totalMinutes < 0;
  if (isOvernight) {
    totalMinutes += 24 * 60;
  }
  
  // 休憩時間の自動控除
  let breakMinutes = 0;
  
  if (totalMinutes >= 8 * 60) {
    // 8時間以上 → 60分休憩
    breakMinutes = 60;
  } else if (totalMinutes >= 6 * 60 + 15) {
    // 6時間15分以上 → 45分休憩
    breakMinutes = 45;
  } else if (totalMinutes >= 6 * 60 && totalMinutes < 6 * 60 + 15) {
    // 6時間〜6時間15分未満 → 休憩なし、6時間として計上
    breakMinutes = 0;
    totalMinutes = 6 * 60;
  }
  // 6時間未満 → 休憩なし
  
  const workMinutes = Math.max(0, totalMinutes - breakMinutes);
  
  return { workMinutes, breakMinutes, isOvernight };
}

// 24時間超過チェック
export function isOvertime(workMinutes: number): boolean {
  return workMinutes > 24 * 60;
}

// 分を「HH:MM」形式に変換
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}
```

### 3. 管理画面（/admin）

**認証：**
- 初回アクセス時にパスワード入力モーダル
- 正しければsessionStorageに認証状態を保存
- ブラウザを閉じるとリセット

**従業員管理：**
- 一覧表示
- 追加（名前入力）
- 編集（名前変更）
- 削除（確認ダイアログ → 論理削除）

**データ管理：**
- フィルタリング（従業員、期間指定）
- 記録一覧テーブル
- 編集（日付、出退勤時刻、備考）→ 労働時間再計算
- 削除（確認ダイアログ）

**月次レポート：**
- 年月選択
- サマリー（総労働時間、従業員数、レコード数）
- 従業員別集計

**CSV出力：**
- フォーマット: 日付,従業員名,シフト番号,出勤時刻,退勤時刻,休憩時間(分),労働時間(分),労働時間(時間),備考
- ダウンロード or クリップボードコピー

---

## API設計

### 従業員
```
GET    /api/employees          → 従業員一覧
POST   /api/employees          → 従業員追加 { name }
PUT    /api/employees          → 従業員更新 { id, name }
DELETE /api/employees?id=xxx   → 従業員削除（論理削除）
```

### 打刻
```
POST   /api/attendance/clock-in   → 出勤 { employeeId }
POST   /api/attendance/clock-out  → 退勤 { employeeId }
```

### 勤怠記録
```
GET    /api/attendance?employeeId=xxx&startDate=xxx&endDate=xxx
PUT    /api/attendance          → 記録更新 { id, workDate, clockIn, clockOut, note }
DELETE /api/attendance?id=xxx   → 記録削除
```

### レポート
```
GET    /api/reports?year=2024&month=1  → 月次レポート
GET    /api/reports/csv?year=2024&month=1 → CSV出力
```

### 認証
```
POST   /api/auth/verify         → パスワード検証 { password }
```

---

## UI設計

### カラースキーム（Tailwind）
```
Primary:    indigo-600 / indigo-700
Success:    emerald-500
Warning:    amber-500
Danger:     red-500
Background: グラデーション（indigo-500 → purple-600）
Card:       white, rounded-xl, shadow-lg
```

### 打刻画面
```
┌─────────────────────────────────────┐
│         🕐 14:32:05                │  ← リアルタイム時計
├─────────────────────────────────────┤
│  従業員: [▼ 田中太郎        ]      │  ← ドロップダウン
├─────────────────────────────────────┤
│      ステータス: 🟢 勤務中          │
│      出勤: 09:00                   │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │         退勤する            │   │  ← 大きなボタン
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  本日の記録:                       │
│  ・第1シフト 09:00-12:30 (3:00)   │
│  ・第2シフト 14:00- 勤務中        │
├─────────────────────────────────────┤
│  [管理画面へ →]                    │
└─────────────────────────────────────┘
```

### レスポンシブ
- モバイル: 1カラム、タップしやすい大きなボタン
- PC: 中央寄せカード、max-width: 480px程度

---

## 環境変数

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxx

# 管理パスワード
ADMIN_PASSWORD=your-secure-password
```

---

## デプロイ手順（Claude Codeで実行）

```bash
# 1. プロジェクト作成
npx create-next-app@latest timecard --typescript --tailwind --app --src-dir=false

# 2. 依存関係インストール
cd timecard
npm install @supabase/supabase-js

# 3. Supabaseプロジェクト作成（Webコンソールで）
#    → URLとanon keyを取得

# 4. 環境変数設定
#    .env.local を作成

# 5. Supabaseでテーブル作成
#    → SQLエディタで上記のCREATE TABLE実行

# 6. コード実装
#    → Claude Codeが全ファイル生成

# 7. ローカルで動作確認
npm run dev

# 8. Vercelにデプロイ
vercel

# 9. Vercelで環境変数を設定
#    → Settings > Environment Variables
```

---

## 実装優先順位

### Phase 1（MVP）
- [ ] プロジェクトセットアップ
- [ ] Supabase接続
- [ ] 従業員テーブル・基本CRUD
- [ ] 打刻機能（出勤/退勤）
- [ ] 労働時間自動計算
- [ ] 打刻画面UI

### Phase 2
- [ ] 複数シフト対応
- [ ] 夜勤（日跨ぎ）対応
- [ ] 連続打刻防止
- [ ] 前日未退勤チェック
- [ ] 管理画面認証

### Phase 3
- [ ] 従業員管理UI
- [ ] データ管理（検索・編集・削除）
- [ ] 月次レポート
- [ ] CSV出力
- [ ] UIブラッシュアップ

---

## Claude Codeへの指示例

```
この設計書に基づいて、Next.js + Supabaseのタイムカードシステムを
実装してください。

まずPhase 1から始めて：
1. create-next-appでプロジェクト作成
2. Supabase接続設定
3. 基本的な打刻機能と画面

Supabaseのテーブルは手動で作るので、SQLだけ出力してください。
環境変数は後で設定するので、.env.local.exampleを作成してください。
```

---

## 注意事項

- SupabaseのURLとキーは公開しない（.env.localで管理）
- ADMIN_PASSWORDは本番用に強力なものを設定
- Vercelの無料枠: 100GB帯域/月、サーバーレス関数10秒タイムアウト
- Supabaseの無料枠: 500MB DB、2GB帯域/月

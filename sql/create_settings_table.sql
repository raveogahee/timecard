-- 設定テーブル作成
-- Supabaseで実行してください

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLSを有効化
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 全てのアクセスを許可するポリシー（アプリ内部からのみアクセス）
CREATE POLICY "Allow all access to settings" ON settings
  FOR ALL USING (true) WITH CHECK (true);

-- 更新時にupdated_atを自動更新するトリガー
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();

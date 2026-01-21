-- テスト用勤怠データ（シンプル版）
-- Supabase SQL Editorで実行してください

-- 既存の勤怠データをクリア（必要に応じて）
DELETE FROM attendance;

-- 従業員ID
-- 田中太郎: 71824798-54ea-4e08-ac90-82a49561b685
-- 佐藤花子: ab494ec6-fc0a-4e89-8259-2209c082e94e
-- 鈴木一郎: 93504103-44cf-4033-961b-733aa9a8b656
-- 高橋タカシ: de0f5b58-abd3-4495-8b6b-a8bd47d5633e

-- 1. 田中太郎 - 通常勤務（3日前）9:00〜18:00
INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
VALUES (
  '71824798-54ea-4e08-ac90-82a49561b685',
  CURRENT_DATE - 3,
  1,
  (CURRENT_DATE - 3) + TIME '09:00:00',
  (CURRENT_DATE - 3) + TIME '18:00:00',
  60, 480, false, 'completed'
);

-- 2. 田中太郎 - 通常勤務（2日前）9:00〜18:00
INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
VALUES (
  '71824798-54ea-4e08-ac90-82a49561b685',
  CURRENT_DATE - 2,
  1,
  (CURRENT_DATE - 2) + TIME '09:00:00',
  (CURRENT_DATE - 2) + TIME '18:00:00',
  60, 480, false, 'completed'
);

-- 3. 田中太郎 - 夜勤（昨日22:00から勤務中 = 未退勤）
INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
VALUES (
  '71824798-54ea-4e08-ac90-82a49561b685',
  CURRENT_DATE - 1,
  1,
  (CURRENT_DATE - 1) + TIME '22:00:00',
  NULL,
  0, 0, false, 'working'
);

-- 4. 佐藤花子 - 夜勤（2日前22:00〜翌7:00、日跨ぎ完了）
INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
VALUES (
  'ab494ec6-fc0a-4e89-8259-2209c082e94e',
  CURRENT_DATE - 2,
  1,
  (CURRENT_DATE - 2) + TIME '22:00:00',
  (CURRENT_DATE - 1) + TIME '07:00:00',
  60, 480, true, 'completed'
);

-- 5. 佐藤花子 - 通常勤務（昨日）9:00〜17:30
INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
VALUES (
  'ab494ec6-fc0a-4e89-8259-2209c082e94e',
  CURRENT_DATE - 1,
  1,
  (CURRENT_DATE - 1) + TIME '09:00:00',
  (CURRENT_DATE - 1) + TIME '17:30:00',
  60, 450, false, 'completed'
);

-- 6. 鈴木一郎 - 短時間勤務（昨日）10:00〜15:00（5時間、休憩なし）
INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
VALUES (
  '93504103-44cf-4033-961b-733aa9a8b656',
  CURRENT_DATE - 1,
  1,
  (CURRENT_DATE - 1) + TIME '10:00:00',
  (CURRENT_DATE - 1) + TIME '15:00:00',
  0, 300, false, 'completed'
);

-- 7. 高橋タカシ - 今日の勤務中（9:00から）
INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
VALUES (
  'de0f5b58-abd3-4495-8b6b-a8bd47d5633e',
  CURRENT_DATE,
  1,
  CURRENT_DATE + TIME '09:00:00',
  NULL,
  0, 0, false, 'working'
);

-- 確認
SELECT
  e.name as "従業員",
  a.work_date as "日付",
  TO_CHAR(a.clock_in, 'HH24:MI') as "出勤",
  COALESCE(TO_CHAR(a.clock_out, 'HH24:MI'), '-') as "退勤",
  a.work_minutes as "労働(分)",
  CASE WHEN a.is_overnight THEN '○' ELSE '' END as "夜勤",
  a.status as "状態"
FROM attendance a
JOIN employees e ON a.employee_id = e.id
ORDER BY a.work_date DESC, e.name;

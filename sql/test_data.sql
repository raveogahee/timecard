-- テスト用勤怠データ
-- 実行前に従業員データが存在することを確認してください

-- 既存の勤怠データをクリア（オプション）
-- DELETE FROM attendance;

-- 従業員IDを変数として取得
DO $$
DECLARE
  tanaka_id UUID;
  sato_id UUID;
  suzuki_id UUID;
  takahashi_id UUID;
  today DATE := CURRENT_DATE;
  yesterday DATE := CURRENT_DATE - 1;
  two_days_ago DATE := CURRENT_DATE - 2;
  three_days_ago DATE := CURRENT_DATE - 3;
BEGIN
  -- 従業員IDを取得
  SELECT id INTO tanaka_id FROM employees WHERE name = '田中太郎' LIMIT 1;
  SELECT id INTO sato_id FROM employees WHERE name = '佐藤花子' LIMIT 1;
  SELECT id INTO suzuki_id FROM employees WHERE name = '鈴木一郎' LIMIT 1;
  SELECT id INTO takahashi_id FROM employees WHERE name = '高橋タカシ' LIMIT 1;

  -- 従業員が存在しない場合は作成
  IF tanaka_id IS NULL THEN
    INSERT INTO employees (name) VALUES ('田中太郎') RETURNING id INTO tanaka_id;
  END IF;
  IF sato_id IS NULL THEN
    INSERT INTO employees (name) VALUES ('佐藤花子') RETURNING id INTO sato_id;
  END IF;
  IF suzuki_id IS NULL THEN
    INSERT INTO employees (name) VALUES ('鈴木一郎') RETURNING id INTO suzuki_id;
  END IF;
  IF takahashi_id IS NULL THEN
    INSERT INTO employees (name) VALUES ('高橋タカシ') RETURNING id INTO takahashi_id;
  END IF;

  -- 1. 通常勤務（完了）- 田中太郎 - 3日前 9:00〜18:00
  -- 労働時間: 9時間 - 60分休憩 = 480分 (8時間)
  INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
  VALUES (
    tanaka_id,
    three_days_ago,
    1,
    three_days_ago + TIME '09:00:00',
    three_days_ago + TIME '18:00:00',
    60,
    480,
    false,
    'completed'
  );

  -- 2. 夜勤（日跨ぎ、完了）- 佐藤花子 - 2日前22:00〜翌7:00
  -- 労働時間: 9時間 - 60分休憩 = 480分 (8時間)
  INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
  VALUES (
    sato_id,
    two_days_ago,
    1,
    two_days_ago + TIME '22:00:00',
    (two_days_ago + 1) + TIME '07:00:00',
    60,
    480,
    true,
    'completed'
  );

  -- 3. 短時間勤務（完了）- 鈴木一郎 - 昨日 10:00〜15:00
  -- 労働時間: 5時間 = 300分（6時間未満なので休憩なし）
  INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
  VALUES (
    suzuki_id,
    yesterday,
    1,
    yesterday + TIME '10:00:00',
    yesterday + TIME '15:00:00',
    0,
    300,
    false,
    'completed'
  );

  -- 4. 現在勤務中 - 高橋タカシ - 今日の9:00から
  INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
  VALUES (
    takahashi_id,
    today,
    1,
    today + TIME '09:00:00',
    NULL,
    0,
    0,
    false,
    'working'
  );

  -- 5. 昨日から勤務中（未退勤）- 田中太郎 - 昨日22:00から（夜勤想定）
  INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
  VALUES (
    tanaka_id,
    yesterday,
    1,
    yesterday + TIME '22:00:00',
    NULL,
    0,
    0,
    false,
    'working'
  );

  -- 追加: 田中太郎の通常勤務（2日前）
  INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
  VALUES (
    tanaka_id,
    two_days_ago,
    1,
    two_days_ago + TIME '09:00:00',
    two_days_ago + TIME '18:00:00',
    60,
    480,
    false,
    'completed'
  );

  -- 追加: 佐藤花子の通常勤務（昨日）
  INSERT INTO attendance (employee_id, work_date, shift_number, clock_in, clock_out, break_minutes, work_minutes, is_overnight, status)
  VALUES (
    sato_id,
    yesterday,
    1,
    yesterday + TIME '09:00:00',
    yesterday + TIME '17:30:00',
    60,
    450,
    false,
    'completed'
  );

  RAISE NOTICE 'テストデータの挿入が完了しました';
  RAISE NOTICE '田中太郎 ID: %', tanaka_id;
  RAISE NOTICE '佐藤花子 ID: %', sato_id;
  RAISE NOTICE '鈴木一郎 ID: %', suzuki_id;
  RAISE NOTICE '高橋タカシ ID: %', takahashi_id;
END $$;

-- 確認用クエリ
SELECT
  e.name as 従業員名,
  a.work_date as 勤務日,
  a.shift_number as シフト,
  TO_CHAR(a.clock_in, 'MM/DD HH24:MI') as 出勤,
  CASE WHEN a.clock_out IS NOT NULL THEN TO_CHAR(a.clock_out, 'MM/DD HH24:MI') ELSE '-' END as 退勤,
  a.break_minutes as 休憩,
  a.work_minutes as 労働,
  CASE WHEN a.is_overnight THEN '○' ELSE '' END as 夜勤,
  a.status as 状態
FROM attendance a
JOIN employees e ON a.employee_id = e.id
ORDER BY a.work_date DESC, e.name, a.shift_number;

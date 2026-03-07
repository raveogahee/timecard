import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 日本時間を取得するヘルパー関数
function getJSTDateTime() {
  const now = new Date()
  // 日本時間の日付文字列を取得（YYYY-MM-DD形式）
  const workDate = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  // 日本時間のISO文字列を生成（+09:00オフセット付き）
  const jstDateTimeStr = now.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const clockIn = jstDateTimeStr.replace(' ', 'T') + '+09:00'
  return { workDate, clockIn }
}

// 出勤打刻
export async function POST(request: NextRequest) {
  try {
    const { employee_id } = await request.json()

    if (!employee_id) {
      return NextResponse.json({ error: '従業員IDが必要です' }, { status: 400 })
    }

    const { workDate, clockIn } = getJSTDateTime()

    // 同日の勤務記録数を取得してシフト番号を決定
    const { data: existingRecords, error: shiftError } = await supabase
      .from('attendance')
      .select('shift_number')
      .eq('employee_id', employee_id)
      .eq('work_date', workDate)
      .order('shift_number', { ascending: false })
      .limit(1)

    if (shiftError) {
      return NextResponse.json({ error: 'シフト情報の取得に失敗しました' }, { status: 500 })
    }

    const shiftNumber = existingRecords && existingRecords.length > 0
      ? existingRecords[0].shift_number + 1
      : 1

    // 出勤中のレコードがあるかチェック（複数レコード対応のためlimit(1)を使用）
    const { data: workingRecords, error: workingError } = await supabase
      .from('attendance')
      .select('id')
      .eq('employee_id', employee_id)
      .eq('status', 'working')
      .limit(1)

    if (workingError) {
      return NextResponse.json({ error: '勤務状態の確認に失敗しました' }, { status: 500 })
    }

    if (workingRecords && workingRecords.length > 0) {
      return NextResponse.json({ error: '既に出勤中です' }, { status: 400 })
    }

    // 出勤記録を作成
    const { data, error } = await supabase
      .from('attendance')
      .insert({
        employee_id,
        work_date: workDate,
        shift_number: shiftNumber,
        clock_in: clockIn,
        break_minutes: 0,
        work_minutes: 0,
        is_overnight: false,
        status: 'working'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '出勤記録の作成に失敗しました' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('出勤打刻エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calculateWorkTime } from '@/lib/worktime'

// 日本時間を取得するヘルパー関数
function getJSTClockOut() {
  const now = new Date()
  // 日本時間のISO文字列を生成（+09:00オフセット付き）
  const jstDateTimeStr = now.toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' })
  return jstDateTimeStr.replace(' ', 'T') + '+09:00'
}

// 退勤打刻
export async function POST(request: NextRequest) {
  try {
    const { employee_id, overtime_minutes } = await request.json()

    if (!employee_id) {
      return NextResponse.json({ error: '従業員IDが必要です' }, { status: 400 })
    }

    // 残業時間がある場合は備考に追加
    const note = overtime_minutes && overtime_minutes > 0
      ? `残業${overtime_minutes}分`
      : null

    const clockOut = getJSTClockOut()

    // 出勤中のレコードを取得（複数レコード対応のためlimit(1)を使用）
    const { data: workingRecords, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('status', 'working')
      .order('clock_in', { ascending: false })
      .limit(1)

    if (fetchError) {
      return NextResponse.json({ error: '勤務状態の確認に失敗しました' }, { status: 500 })
    }

    if (!workingRecords || workingRecords.length === 0) {
      return NextResponse.json({ error: '出勤記録がありません' }, { status: 400 })
    }

    const workingRecord = workingRecords[0]

    // 労働時間と休憩時間を計算
    const clockInDate = new Date(workingRecord.clock_in)
    const clockOutDate = new Date(clockOut)
    const { workMinutes, breakMinutes, isOvernight } = calculateWorkTime(clockInDate, clockOutDate)

    // 退勤記録を更新
    const { data, error } = await supabase
      .from('attendance')
      .update({
        clock_out: clockOut,
        break_minutes: breakMinutes,
        work_minutes: workMinutes,
        is_overnight: isOvernight,
        status: 'completed',
        note: note
      })
      .eq('id', workingRecord.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '退勤記録の更新に失敗しました' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('退勤打刻エラー:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

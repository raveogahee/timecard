import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 日本時間の今日の日付を取得
function getJSTToday() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// 従業員の勤務状態を取得（全期間でstatus='working'のレコードを検索）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employee_id')

  if (!employeeId) {
    return NextResponse.json({ error: '従業員IDが必要です' }, { status: 400 })
  }

  const today = getJSTToday()

  // 勤務中のレコードを取得（日付に関係なく）
  const { data: workingRecord, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('status', 'working')
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 前日以前の未退勤かどうか
  const isOldWorkingRecord = workingRecord && workingRecord.work_date < today

  return NextResponse.json({
    isWorking: !!workingRecord,
    workingRecord: workingRecord,
    isOldWorkingRecord: isOldWorkingRecord
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 日本時間の今日の日付を取得
function getJSTToday() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

// 本日の勤務記録取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employee_id')

  if (!employeeId) {
    return NextResponse.json({ error: '従業員IDが必要です' }, { status: 400 })
  }

  const today = getJSTToday()

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('work_date', today)
    .order('shift_number')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calculateWorkTime } from '@/lib/worktime'

// 勤怠記録一覧取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const employeeId = searchParams.get('employee_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')

  let query = supabase
    .from('attendance')
    .select(`
      *,
      employees (
        id,
        name
      )
    `)
    .order('work_date', { ascending: false })
    .order('shift_number', { ascending: true })

  if (employeeId) {
    query = query.eq('employee_id', employeeId)
  }

  if (startDate) {
    query = query.gte('work_date', startDate)
  }

  if (endDate) {
    query = query.lte('work_date', endDate)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// 勤怠記録更新
export async function PUT(request: NextRequest) {
  const { id, work_date, clock_in, clock_out, note } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString()
  }

  if (work_date !== undefined) updateData.work_date = work_date
  if (clock_in !== undefined) updateData.clock_in = clock_in
  if (clock_out !== undefined) updateData.clock_out = clock_out
  if (note !== undefined) updateData.note = note

  // 出勤・退勤時刻が両方ある場合は労働時間を再計算
  if (clock_in && clock_out) {
    const clockInDate = new Date(clock_in)
    const clockOutDate = new Date(clock_out)
    const { workMinutes, breakMinutes, isOvernight } = calculateWorkTime(clockInDate, clockOutDate)

    updateData.work_minutes = workMinutes
    updateData.break_minutes = breakMinutes
    updateData.is_overnight = isOvernight
    updateData.status = 'completed'
  }

  const { data, error } = await supabase
    .from('attendance')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// 勤怠記録削除
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
  }

  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

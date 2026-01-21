import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 月次レポート取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  const format = searchParams.get('format') // 'json' or 'csv'

  if (!year || !month) {
    return NextResponse.json({ error: '年月が必要です' }, { status: 400 })
  }

  const startDate = `${year}-${month.padStart(2, '0')}-01`
  const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0]

  // 勤怠データ取得
  const { data: attendanceData, error: attendanceError } = await supabase
    .from('attendance')
    .select(`
      *,
      employees (
        id,
        name
      )
    `)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .eq('status', 'completed')
    .order('work_date')
    .order('shift_number')

  if (attendanceError) {
    return NextResponse.json({ error: attendanceError.message }, { status: 500 })
  }

  // 従業員一覧取得
  const { data: employeesData } = await supabase
    .from('employees')
    .select('*')
    .order('name')

  // CSV形式の場合
  if (format === 'csv') {
    const csvRows = [
      '日付,従業員名,シフト番号,出勤時刻,退勤時刻,休憩時間(分),労働時間(分),労働時間(時間),備考'
    ]

    for (const record of attendanceData || []) {
      const employee = record.employees as { name: string } | null
      const workHours = record.work_minutes ? (record.work_minutes / 60).toFixed(2) : '0'
      const clockIn = record.clock_in ? new Date(record.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : ''
      const clockOut = record.clock_out ? new Date(record.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : ''

      csvRows.push([
        record.work_date,
        employee?.name || '',
        record.shift_number,
        clockIn,
        clockOut,
        record.break_minutes || 0,
        record.work_minutes || 0,
        workHours,
        (record.note || '').replace(/,/g, '，').replace(/\n/g, ' ')
      ].join(','))
    }

    return new NextResponse(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="attendance_${year}${month.padStart(2, '0')}.csv"`
      }
    })
  }

  // JSON形式（サマリー付き）
  const employeeSummary: Record<string, {
    name: string
    totalWorkMinutes: number
    totalDays: number
    records: number
  }> = {}

  for (const record of attendanceData || []) {
    const employee = record.employees as { id: string; name: string } | null
    if (!employee) continue

    if (!employeeSummary[employee.id]) {
      employeeSummary[employee.id] = {
        name: employee.name,
        totalWorkMinutes: 0,
        totalDays: 0,
        records: 0
      }
    }

    employeeSummary[employee.id].totalWorkMinutes += record.work_minutes || 0
    employeeSummary[employee.id].records += 1
  }

  // 勤務日数をカウント（同日複数シフトは1日とカウント）
  const workDays: Record<string, Set<string>> = {}
  for (const record of attendanceData || []) {
    const employee = record.employees as { id: string } | null
    if (!employee) continue

    if (!workDays[employee.id]) {
      workDays[employee.id] = new Set()
    }
    workDays[employee.id].add(record.work_date)
  }

  for (const empId of Object.keys(employeeSummary)) {
    employeeSummary[empId].totalDays = workDays[empId]?.size || 0
  }

  // サマリー計算
  const totalWorkMinutes = Object.values(employeeSummary).reduce((sum, e) => sum + e.totalWorkMinutes, 0)
  const totalRecords = attendanceData?.length || 0
  const activeEmployees = Object.keys(employeeSummary).length

  return NextResponse.json({
    year: Number(year),
    month: Number(month),
    summary: {
      totalWorkMinutes,
      totalWorkHours: Math.floor(totalWorkMinutes / 60),
      totalRecords,
      activeEmployees
    },
    employees: Object.entries(employeeSummary).map(([id, data]) => ({
      id,
      ...data,
      totalWorkHours: Math.floor(data.totalWorkMinutes / 60),
      totalWorkMinutesRemainder: data.totalWorkMinutes % 60
    })),
    allEmployees: employeesData,
    records: attendanceData
  })
}

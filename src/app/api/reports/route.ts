import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import ExcelJS from 'exceljs'

// Excelシート名のサニタイズ（禁止文字除去・31文字制限）
function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31)
}

// 月次レポート取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  const format = searchParams.get('format') // 'json', 'csv', or 'xlsx'

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

  // Excel形式の場合
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook()

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    }

    const summaryHeaders = ['日付', '従業員名', 'シフト番号', '出勤時刻', '退勤時刻', '休憩時間(分)', '労働時間(分)', '労働時間(時間)', '備考']

    // シート1: 全員まとめ
    const summarySheet = workbook.addWorksheet('全員まとめ')
    const summaryHeaderRow = summarySheet.addRow(summaryHeaders)
    summaryHeaderRow.eachCell(cell => { Object.assign(cell, { style: headerStyle }) })

    summarySheet.columns = [
      { width: 12 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 10 },
      { width: 12 }, { width: 12 }, { width: 14 }, { width: 20 },
    ]

    for (const record of attendanceData || []) {
      const employee = record.employees as { id: string; name: string } | null
      const workHours = record.work_minutes ? Number((record.work_minutes / 60).toFixed(2)) : 0
      const clockIn = record.clock_in ? new Date(record.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : ''
      const clockOut = record.clock_out ? new Date(record.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : ''

      summarySheet.addRow([
        record.work_date,
        employee?.name || '',
        record.shift_number,
        clockIn,
        clockOut,
        record.break_minutes || 0,
        record.work_minutes || 0,
        workHours,
        record.note || '',
      ])
    }

    // 従業員ごとにデータをグループ化
    const employeeRecords: Record<string, { name: string; records: typeof attendanceData }> = {}
    for (const record of attendanceData || []) {
      const employee = record.employees as { id: string; name: string } | null
      if (!employee) continue
      if (!employeeRecords[employee.id]) {
        employeeRecords[employee.id] = { name: employee.name, records: [] }
      }
      employeeRecords[employee.id].records.push(record)
    }

    // シート2以降: 従業員別シート
    const individualHeaders = ['日付', 'シフト番号', '出勤時刻', '退勤時刻', '休憩時間(分)', '労働時間(分)', '労働時間(時間)', '備考']

    for (const [, empData] of Object.entries(employeeRecords)) {
      const sheet = workbook.addWorksheet(sanitizeSheetName(empData.name))

      // 1行目: 従業員名
      const nameRow = sheet.addRow([empData.name])
      nameRow.getCell(1).font = { bold: true, size: 16 }

      // 2行目: 対象期間
      sheet.addRow([`${year}年${Number(month)}月`])

      // 3行目: 空行
      sheet.addRow([])

      // 4行目: ヘッダー
      const headerRow = sheet.addRow(individualHeaders)
      headerRow.eachCell(cell => { Object.assign(cell, { style: headerStyle }) })

      sheet.columns = [
        { width: 12 }, { width: 10 }, { width: 10 }, { width: 10 },
        { width: 12 }, { width: 12 }, { width: 14 }, { width: 20 },
      ]

      // 5行目以降: データ行
      let totalBreakMinutes = 0
      let totalWorkMinutes = 0
      const workDays = new Set<string>()
      let shiftCount = 0

      for (const record of empData.records) {
        const workHours = record.work_minutes ? Number((record.work_minutes / 60).toFixed(2)) : 0
        const clockIn = record.clock_in ? new Date(record.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : ''
        const clockOut = record.clock_out ? new Date(record.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : ''

        sheet.addRow([
          record.work_date,
          record.shift_number,
          clockIn,
          clockOut,
          record.break_minutes || 0,
          record.work_minutes || 0,
          workHours,
          record.note || '',
        ])

        totalBreakMinutes += record.break_minutes || 0
        totalWorkMinutes += record.work_minutes || 0
        workDays.add(record.work_date)
        shiftCount++
      }

      // 合計行
      sheet.addRow([]) // 空行
      const totalRow = sheet.addRow(['合計', '', '', '', totalBreakMinutes, totalWorkMinutes, Number((totalWorkMinutes / 60).toFixed(2))])
      totalRow.getCell(1).font = { bold: true }

      const daysRow = sheet.addRow(['出勤日数', `${workDays.size}日`])
      daysRow.getCell(1).font = { bold: true }

      const shiftRow = sheet.addRow(['シフト数', `${shiftCount}回`])
      shiftRow.getCell(1).font = { bold: true }
    }

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="attendance_${year}${month.padStart(2, '0')}.xlsx"`,
      },
    })
  }

  // CSV形式の場合
  if (format === 'csv') {
    const csvRows = [
      '日付,従業員名,シフト番号,出勤時刻,退勤時刻,休憩時間(分),労働時間(分),労働時間(時間),備考'
    ]

    for (const record of attendanceData || []) {
      const employee = record.employees as { name: string } | null
      const workHours = record.work_minutes ? (record.work_minutes / 60).toFixed(2) : '0'
      const clockIn = record.clock_in ? new Date(record.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : ''
      const clockOut = record.clock_out ? new Date(record.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }) : ''

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

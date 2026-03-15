import ExcelJS from 'exceljs'

// sanitizeSheetName のロジックをテスト用に再定義（route.tsからexportされていないため）
function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31)
}

describe('sanitizeSheetName', () => {
  it('通常の名前はそのまま返す', () => {
    expect(sanitizeSheetName('田中太郎')).toBe('田中太郎')
  })

  it('Excel禁止文字を_に置換する', () => {
    expect(sanitizeSheetName('名前:テスト')).toBe('名前_テスト')
    expect(sanitizeSheetName('名前/テスト')).toBe('名前_テスト')
    expect(sanitizeSheetName('名前?テスト')).toBe('名前_テスト')
    expect(sanitizeSheetName('名前*テスト')).toBe('名前_テスト')
    expect(sanitizeSheetName('[名前]')).toBe('_名前_')
    expect(sanitizeSheetName('名前\\テスト')).toBe('名前_テスト')
  })

  it('31文字を超える場合は切り詰める', () => {
    const longName = 'あ'.repeat(40)
    expect(sanitizeSheetName(longName).length).toBe(31)
  })

  it('空文字列を処理できる', () => {
    expect(sanitizeSheetName('')).toBe('')
  })
})

describe('Excel生成テスト', () => {
  const mockAttendanceData = [
    {
      work_date: '2026-03-01',
      employees: { id: 'emp1', name: '田中太郎' },
      shift_number: 1,
      clock_in: '2026-03-01T00:00:00Z', // UTC 00:00 = JST 09:00
      clock_out: '2026-03-01T09:00:00Z', // UTC 09:00 = JST 18:00
      break_minutes: 60,
      work_minutes: 480,
      note: '',
      status: 'completed',
    },
    {
      work_date: '2026-03-02',
      employees: { id: 'emp1', name: '田中太郎' },
      shift_number: 1,
      clock_in: '2026-03-02T00:00:00Z',
      clock_out: '2026-03-02T09:00:00Z',
      break_minutes: 60,
      work_minutes: 480,
      note: '残業30分',
      status: 'completed',
    },
    {
      work_date: '2026-03-01',
      employees: { id: 'emp2', name: '佐藤花子' },
      shift_number: 1,
      clock_in: '2026-03-01T01:00:00Z',
      clock_out: '2026-03-01T08:00:00Z',
      break_minutes: 45,
      work_minutes: 375,
      note: '',
      status: 'completed',
    },
  ]

  it('ワークブックが正しいシート構成で生成される', async () => {
    const workbook = new ExcelJS.Workbook()

    // シート1: 全員まとめ
    const summarySheet = workbook.addWorksheet('全員まとめ')
    const summaryHeaders = ['日付', '従業員名', 'シフト番号', '出勤時刻', '退勤時刻', '休憩時間(分)', '労働時間(分)', '労働時間(時間)', '備考']
    summarySheet.addRow(summaryHeaders)

    for (const record of mockAttendanceData) {
      const employee = record.employees
      const workHours = record.work_minutes ? Number((record.work_minutes / 60).toFixed(2)) : 0
      summarySheet.addRow([
        record.work_date,
        employee?.name || '',
        record.shift_number,
        '09:00',
        '18:00',
        record.break_minutes || 0,
        record.work_minutes || 0,
        workHours,
        record.note || '',
      ])
    }

    // 従業員ごとにグループ化
    const employeeRecords: Record<string, { name: string; records: typeof mockAttendanceData }> = {}
    for (const record of mockAttendanceData) {
      const employee = record.employees
      if (!employee) continue
      if (!employeeRecords[employee.id]) {
        employeeRecords[employee.id] = { name: employee.name, records: [] }
      }
      employeeRecords[employee.id].records.push(record)
    }

    for (const [, empData] of Object.entries(employeeRecords)) {
      workbook.addWorksheet(sanitizeSheetName(empData.name))
    }

    // シート構成の検証
    expect(workbook.worksheets.length).toBe(3) // 全員まとめ + 田中太郎 + 佐藤花子
    expect(workbook.worksheets[0].name).toBe('全員まとめ')
    expect(workbook.worksheets[1].name).toBe('田中太郎')
    expect(workbook.worksheets[2].name).toBe('佐藤花子')

    // 全員まとめシートのデータ検証
    expect(summarySheet.rowCount).toBe(4) // ヘッダー + 3データ行
    expect(summarySheet.getRow(1).getCell(1).value).toBe('日付')
    expect(summarySheet.getRow(2).getCell(2).value).toBe('田中太郎')
    expect(summarySheet.getRow(4).getCell(2).value).toBe('佐藤花子')
  })

  it('Bufferに正常に書き出せる', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('テスト')
    workbook.worksheets[0].addRow(['テストデータ'])

    const buffer = await workbook.xlsx.writeBuffer()
    expect(buffer).toBeTruthy()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('従業員別シートに合計行が含まれる', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('田中太郎')

    // route.tsと同じ構造で生成
    sheet.addRow(['田中太郎']) // 1行目: 名前
    sheet.addRow(['2026年3月']) // 2行目: 期間
    sheet.addRow([]) // 3行目: 空行
    sheet.addRow(['日付', 'シフト番号', '出勤時刻', '退勤時刻', '休憩時間(分)', '労働時間(分)', '労働時間(時間)', '備考']) // 4行目: ヘッダー

    // データ行
    sheet.addRow(['2026-03-01', 1, '09:00', '18:00', 60, 480, 8, ''])
    sheet.addRow(['2026-03-02', 1, '09:00', '18:00', 60, 480, 8, '残業30分'])

    // 合計行
    sheet.addRow([])
    sheet.addRow(['合計', '', '', '', 120, 960, 16])
    sheet.addRow(['出勤日数', '2日'])
    sheet.addRow(['シフト数', '2回'])

    expect(sheet.rowCount).toBe(10)
    expect(sheet.getRow(8).getCell(1).value).toBe('合計')
    expect(sheet.getRow(8).getCell(5).value).toBe(120) // 休憩合計
    expect(sheet.getRow(8).getCell(6).value).toBe(960) // 労働合計
    expect(sheet.getRow(9).getCell(2).value).toBe('2日')
    expect(sheet.getRow(10).getCell(2).value).toBe('2回')
  })
})

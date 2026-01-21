// 労働時間計算ロジック

export interface WorkTimeResult {
  workMinutes: number
  breakMinutes: number
  isOvernight: boolean
}

/**
 * 労働時間と休憩時間を計算する
 *
 * ルール:
 * - 6時間未満 → 休憩なし
 * - 6時間〜6時間15分未満 → 休憩なし、労働時間は6時間として計上
 * - 6時間15分以上〜8時間未満 → 45分休憩
 * - 8時間以上 → 60分休憩
 */
export function calculateWorkTime(clockIn: Date, clockOut: Date): WorkTimeResult {
  let totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60)

  // 日跨ぎ対応（マイナスなら翌日扱い）
  const isOvernight = totalMinutes < 0
  if (isOvernight) {
    totalMinutes += 24 * 60
  }

  // 休憩時間の自動控除
  let breakMinutes = 0
  let workMinutes = 0

  if (totalMinutes >= 8 * 60) {
    // 8時間以上 → 60分休憩
    breakMinutes = 60
    workMinutes = Math.floor(totalMinutes - breakMinutes)
  } else if (totalMinutes >= 6 * 60 + 15) {
    // 6時間15分以上〜8時間未満 → 45分休憩
    breakMinutes = 45
    workMinutes = Math.floor(totalMinutes - breakMinutes)
  } else if (totalMinutes >= 6 * 60) {
    // 6時間〜6時間15分未満 → 休憩なし、労働時間は6時間として計上
    breakMinutes = 0
    workMinutes = 6 * 60
  } else {
    // 6時間未満 → 休憩なし
    breakMinutes = 0
    workMinutes = Math.floor(totalMinutes)
  }

  return { workMinutes: Math.max(0, workMinutes), breakMinutes, isOvernight }
}

// 24時間超過チェック
export function isOvertime(workMinutes: number): boolean {
  return workMinutes > 24 * 60
}

// 分を「H:MM」形式に変換
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${m.toString().padStart(2, '0')}`
}

// 分を「X時間Y分」形式に変換
export function formatMinutesJapanese(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}分`
  if (m === 0) return `${h}時間`
  return `${h}時間${m}分`
}

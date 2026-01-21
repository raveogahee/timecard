import { calculateWorkTime, formatMinutes, formatMinutesJapanese } from '../lib/worktime'

describe('calculateWorkTime', () => {
  // ヘルパー関数：時間を指定してDateオブジェクトを作成
  const createTime = (hours: number, minutes: number = 0) => {
    const date = new Date('2026-01-20')
    date.setHours(hours, minutes, 0, 0)
    return date
  }

  describe('休憩なし（6時間未満）', () => {
    test('5時間勤務 → 休憩なし、労働5時間', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(14, 0))
      expect(result.workMinutes).toBe(300) // 5時間
      expect(result.breakMinutes).toBe(0)
      expect(result.isOvernight).toBe(false)
    })

    test('3時間30分勤務 → 休憩なし、労働3時間30分', () => {
      const result = calculateWorkTime(createTime(10, 0), createTime(13, 30))
      expect(result.workMinutes).toBe(210) // 3時間30分
      expect(result.breakMinutes).toBe(0)
    })

    test('5時間59分勤務 → 休憩なし、労働5時間59分', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(14, 59))
      expect(result.workMinutes).toBe(359)
      expect(result.breakMinutes).toBe(0)
    })
  })

  describe('6時間〜6時間15分未満 → 休憩なし、労働6時間固定', () => {
    test('ちょうど6時間勤務 → 休憩なし、労働6時間', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(15, 0))
      expect(result.workMinutes).toBe(360) // 6時間
      expect(result.breakMinutes).toBe(0)
    })

    test('6時間5分勤務 → 休憩なし、労働6時間（6時間として計上）', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(15, 5))
      expect(result.workMinutes).toBe(360) // 6時間固定
      expect(result.breakMinutes).toBe(0)
    })

    test('6時間14分勤務 → 休憩なし、労働6時間（6時間として計上）', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(15, 14))
      expect(result.workMinutes).toBe(360) // 6時間固定
      expect(result.breakMinutes).toBe(0)
    })
  })

  describe('45分休憩（6時間15分以上〜8時間未満）', () => {
    test('6時間15分勤務 → 45分休憩、労働5時間30分', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(15, 15))
      expect(result.workMinutes).toBe(330) // 6時間15分 - 45分 = 5時間30分
      expect(result.breakMinutes).toBe(45)
    })

    test('7時間勤務 → 45分休憩、労働6時間15分', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(16, 0))
      expect(result.workMinutes).toBe(375) // 7時間 - 45分 = 6時間15分
      expect(result.breakMinutes).toBe(45)
    })

    test('7時間59分勤務 → 45分休憩、労働7時間14分', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(16, 59))
      expect(result.workMinutes).toBe(434) // 7時間59分 - 45分 = 7時間14分
      expect(result.breakMinutes).toBe(45)
    })
  })

  describe('60分休憩（8時間以上）', () => {
    test('8時間勤務 → 60分休憩、労働7時間', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(17, 0))
      expect(result.workMinutes).toBe(420) // 8時間 - 60分 = 7時間
      expect(result.breakMinutes).toBe(60)
    })

    test('9時間勤務 → 60分休憩、労働8時間', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(18, 0))
      expect(result.workMinutes).toBe(480) // 9時間 - 60分 = 8時間
      expect(result.breakMinutes).toBe(60)
    })

    test('10時間勤務 → 60分休憩、労働9時間', () => {
      const result = calculateWorkTime(createTime(9, 0), createTime(19, 0))
      expect(result.workMinutes).toBe(540) // 10時間 - 60分 = 9時間
      expect(result.breakMinutes).toBe(60)
    })
  })

  describe('夜勤（日跨ぎ）対応', () => {
    test('22:00〜翌7:00（9時間勤務）→ 60分休憩、労働8時間', () => {
      const clockIn = createTime(22, 0)
      const clockOut = createTime(7, 0) // 翌日の7:00
      const result = calculateWorkTime(clockIn, clockOut)
      expect(result.workMinutes).toBe(480) // 9時間 - 60分 = 8時間
      expect(result.breakMinutes).toBe(60)
      expect(result.isOvernight).toBe(true)
    })

    test('23:00〜翌3:00（4時間勤務）→ 休憩なし、労働4時間', () => {
      const clockIn = createTime(23, 0)
      const clockOut = createTime(3, 0) // 翌日の3:00
      const result = calculateWorkTime(clockIn, clockOut)
      expect(result.workMinutes).toBe(240) // 4時間
      expect(result.breakMinutes).toBe(0)
      expect(result.isOvernight).toBe(true)
    })
  })
})

describe('formatMinutes', () => {
  test('0分 → "0:00"', () => {
    expect(formatMinutes(0)).toBe('0:00')
  })

  test('60分 → "1:00"', () => {
    expect(formatMinutes(60)).toBe('1:00')
  })

  test('90分 → "1:30"', () => {
    expect(formatMinutes(90)).toBe('1:30')
  })

  test('480分 → "8:00"', () => {
    expect(formatMinutes(480)).toBe('8:00')
  })

  test('null → "-"', () => {
    expect(formatMinutes(null)).toBe('-')
  })
})

describe('formatMinutesJapanese', () => {
  test('0分 → "0分"', () => {
    expect(formatMinutesJapanese(0)).toBe('0分')
  })

  test('60分 → "1時間"', () => {
    expect(formatMinutesJapanese(60)).toBe('1時間')
  })

  test('90分 → "1時間30分"', () => {
    expect(formatMinutesJapanese(90)).toBe('1時間30分')
  })

  test('30分 → "30分"', () => {
    expect(formatMinutesJapanese(30)).toBe('30分')
  })

  test('null → "-"', () => {
    expect(formatMinutesJapanese(null)).toBe('-')
  })
})

'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Employee, Attendance } from '@/types'
import { formatMinutesJapanese } from '@/lib/worktime'

const PUNCH_COOLDOWN_SECONDS = 5

export default function Home() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string>('')
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)
  const [todayRecords, setTodayRecords] = useState<Attendance[]>([])
  const [isWorking, setIsWorking] = useState(false)
  const [workingRecord, setWorkingRecord] = useState<Attendance | null>(null)
  const [isOldWorkingRecord, setIsOldWorkingRecord] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  // 残業申請
  const [showOvertimeForm, setShowOvertimeForm] = useState(false)
  const [overtimeMinutes, setOvertimeMinutes] = useState<number>(15)

  // 連続打刻防止
  const [lastPunchTime, setLastPunchTime] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  // マウント後にクライアントサイドで時計を初期化
  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date())
  }, [])

  // リアルタイム時計
  useEffect(() => {
    if (!mounted) return

    const timer = setInterval(() => {
      setCurrentTime(new Date())

      // クールダウン残り時間を更新
      if (lastPunchTime) {
        const elapsed = (Date.now() - new Date(lastPunchTime).getTime()) / 1000
        const remaining = Math.max(0, PUNCH_COOLDOWN_SECONDS - elapsed)
        setCooldownRemaining(Math.ceil(remaining))
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [mounted, lastPunchTime])

  // 従業員一覧取得
  useEffect(() => {
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmployees(data)
        }
      })
      .catch(err => console.error('従業員取得エラー:', err))
  }, [])

  // 勤務状態取得
  const fetchWorkingStatus = useCallback(async () => {
    if (!selectedEmployee) {
      setIsWorking(false)
      setWorkingRecord(null)
      setIsOldWorkingRecord(false)
      return
    }

    try {
      const res = await fetch(`/api/attendance/status?employee_id=${selectedEmployee}`)
      const data = await res.json()

      setIsWorking(data.isWorking || false)
      setWorkingRecord(data.workingRecord || null)
      setIsOldWorkingRecord(data.isOldWorkingRecord || false)
    } catch (err) {
      console.error('勤務状態取得エラー:', err)
    }
  }, [selectedEmployee])

  // 本日の勤務記録取得
  const fetchTodayRecords = useCallback(async () => {
    if (!selectedEmployee) {
      setTodayRecords([])
      return
    }

    const res = await fetch(`/api/attendance/today?employee_id=${selectedEmployee}`)
    const data = await res.json()

    if (Array.isArray(data)) {
      setTodayRecords(data)
    }
  }, [selectedEmployee])

  // 従業員選択時にデータ取得とクールダウンリセット
  useEffect(() => {
    setLastPunchTime(null)
    setCooldownRemaining(0)
    fetchWorkingStatus()
    fetchTodayRecords()
  }, [selectedEmployee, fetchWorkingStatus, fetchTodayRecords])

  // 連続打刻チェック
  const canPunch = () => {
    if (!lastPunchTime) return true
    const elapsed = (Date.now() - new Date(lastPunchTime).getTime()) / 1000
    return elapsed >= PUNCH_COOLDOWN_SECONDS
  }

  // 出勤打刻
  const handleClockIn = async () => {
    if (!selectedEmployee) {
      setMessage({ text: '従業員を選択してください', type: 'error' })
      return
    }

    if (!canPunch()) {
      setMessage({ text: `${cooldownRemaining}秒後に打刻できます`, type: 'error' })
      return
    }

    setLoading(true)
    setMessage({ text: '', type: '' })

    try {
      const res = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: selectedEmployee })
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ text: '出勤しました', type: 'success' })
        setLastPunchTime(new Date().toISOString())
        fetchWorkingStatus()
        fetchTodayRecords()
      } else {
        setMessage({ text: data.error || '出勤処理に失敗しました', type: 'error' })
      }
    } catch {
      setMessage({ text: 'エラーが発生しました', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // 退勤打刻
  const handleClockOut = async (withOvertime: boolean = false) => {
    if (!selectedEmployee) {
      setMessage({ text: '従業員を選択してください', type: 'error' })
      return
    }

    if (!canPunch()) {
      setMessage({ text: `${cooldownRemaining}秒後に打刻できます`, type: 'error' })
      return
    }

    setLoading(true)
    setMessage({ text: '', type: '' })

    try {
      const body: { employee_id: string; overtime_minutes?: number } = {
        employee_id: selectedEmployee
      }

      if (withOvertime && overtimeMinutes > 0) {
        body.overtime_minutes = overtimeMinutes
      }

      const res = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (res.ok) {
        const msg = withOvertime && overtimeMinutes > 0
          ? `退勤しました（残業${overtimeMinutes}分を申請）`
          : '退勤しました'
        setMessage({ text: msg, type: 'success' })
        setLastPunchTime(new Date().toISOString())
        setShowOvertimeForm(false)
        setOvertimeMinutes(15)
        fetchWorkingStatus()
        fetchTodayRecords()
      } else {
        setMessage({ text: data.error || '退勤処理に失敗しました', type: 'error' })
      }
    } catch {
      setMessage({ text: 'エラーが発生しました', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // 時刻フォーマット（日本時間で表示）
  const formatTimeDisplay = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    })
  }

  // 日付フォーマット
  const formatDateDisplay = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* 時計カード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4 text-center">
          <div className="text-5xl font-mono font-bold text-gray-800 tracking-wider">
            {currentTime ? currentTime.toLocaleTimeString('ja-JP') : '--:--:--'}
          </div>
          <div className="text-gray-500 mt-2">
            {currentTime ? currentTime.toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long'
            }) : '読み込み中...'}
          </div>
        </div>

        {/* 従業員選択カード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
          <label className="block text-gray-700 font-medium mb-2">
            従業員
          </label>
          <select
            className="w-full p-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="">選択してください</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>

        {/* 前日未退勤の警告 */}
        {isOldWorkingRecord && workingRecord && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-lg">!</span>
              <div>
                <p className="font-medium text-red-800">前日以前の未退勤があります</p>
                <p className="text-sm text-red-700 mt-1">
                  {formatDateDisplay(workingRecord.work_date)} {formatTimeDisplay(workingRecord.clock_in)} から勤務中
                </p>
                <p className="text-sm text-red-600 mt-1">
                  退勤処理を行ってください
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ステータス表示 */}
        {selectedEmployee && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-600">ステータス</span>
              <span className={`flex items-center gap-2 font-medium ${
                isWorking ? 'text-blue-600' : 'text-gray-500'
              }`}>
                <span className={`w-3 h-3 rounded-full ${
                  isWorking ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                }`}></span>
                {isWorking ? '勤務中' : '未出勤'}
              </span>
            </div>
            {workingRecord && (
              <div className="text-gray-600">
                <span className="text-sm text-gray-500">
                  {isOldWorkingRecord && `${formatDateDisplay(workingRecord.work_date)} `}
                </span>
                出勤: {formatTimeDisplay(workingRecord.clock_in)}
              </div>
            )}
          </div>
        )}

        {/* 打刻ボタン */}
        <div className="mb-4">
          {isWorking ? (
            <>
              <button
                onClick={() => handleClockOut(false)}
                disabled={loading || !selectedEmployee || !canPunch()}
                className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white font-bold py-5 px-6 rounded-xl text-xl transition-colors shadow-sm"
              >
                {cooldownRemaining > 0 ? `退勤する (${cooldownRemaining}秒)` : '退勤する'}
              </button>

              {/* 残業申請エリア */}
              <div className="mt-3">
                {!showOvertimeForm ? (
                  <button
                    onClick={() => setShowOvertimeForm(true)}
                    className="w-full text-orange-600 hover:text-orange-700 text-sm py-2 transition-colors"
                  >
                    残業がある場合はこちら
                  </button>
                ) : (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <label className="text-gray-700 text-sm font-medium whitespace-nowrap">
                        残業時間
                      </label>
                      <select
                        value={overtimeMinutes}
                        onChange={(e) => setOvertimeMinutes(Number(e.target.value))}
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      >
                        <option value={15}>15分</option>
                        <option value={30}>30分</option>
                        <option value={45}>45分</option>
                        <option value={60}>1時間</option>
                        <option value={75}>1時間15分</option>
                        <option value={90}>1時間30分</option>
                        <option value={105}>1時間45分</option>
                        <option value={120}>2時間</option>
                        <option value={135}>2時間15分</option>
                        <option value={150}>2時間30分</option>
                        <option value={165}>2時間45分</option>
                        <option value={180}>3時間</option>
                      </select>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => setShowOvertimeForm(false)}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={() => handleClockOut(true)}
                        disabled={loading || !canPunch()}
                        className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                      >
                        残業申請して退勤
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={handleClockIn}
              disabled={loading || !selectedEmployee || !canPunch()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-5 px-6 rounded-xl text-xl transition-colors shadow-sm"
            >
              {cooldownRemaining > 0 ? `出勤する (${cooldownRemaining}秒)` : '出勤する'}
            </button>
          )}
        </div>

        {/* メッセージ */}
        {message.text && (
          <div className={`p-4 rounded-xl mb-4 text-center font-medium ${
            message.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* 本日の勤務記録 */}
        {selectedEmployee && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">本日の記録</h2>
            {todayRecords.length === 0 ? (
              <p className="text-gray-400 text-center py-4">記録がありません</p>
            ) : (
              <div className="space-y-3">
                {todayRecords.map(record => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">第{record.shift_number}シフト</span>
                      <span className="text-gray-800">
                        {formatTimeDisplay(record.clock_in)}
                        {record.clock_out ? `-${formatTimeDisplay(record.clock_out)}` : '-'}
                      </span>
                      {record.is_overnight && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          夜勤
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {record.status === 'working' ? (
                        <span className="text-blue-600 text-sm font-medium">勤務中</span>
                      ) : (
                        <span className="text-gray-600 text-sm">
                          {formatMinutesJapanese(record.work_minutes)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 管理画面リンク */}
        <div className="text-center">
          <Link
            href="/admin"
            className="text-gray-500 hover:text-gray-700 text-sm transition-colors"
          >
            管理画面へ →
          </Link>
        </div>
      </div>
    </div>
  )
}

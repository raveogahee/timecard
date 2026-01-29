'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Employee, Attendance } from '@/types'
import { formatMinutesJapanese } from '@/lib/worktime'

type Tab = 'employees' | 'attendance' | 'reports'

interface AttendanceWithEmployee extends Attendance {
  employees: { id: string; name: string } | null
}

interface EmployeeSummary {
  id: string
  name: string
  totalWorkMinutes: number
  totalWorkHours: number
  totalWorkMinutesRemainder: number
  totalDays: number
  records: number
}

interface ReportData {
  year: number
  month: number
  summary: {
    totalWorkMinutes: number
    totalWorkHours: number
    totalRecords: number
    activeEmployees: number
  }
  employees: EmployeeSummary[]
}

export default function AdminPage() {
  // 認証状態
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')

  // タブ
  const [activeTab, setActiveTab] = useState<Tab>('employees')

  // 従業員管理
  const [employees, setEmployees] = useState<Employee[]>([])
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)

  // 勤怠記録
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceWithEmployee[]>([])
  const [filterEmployeeId, setFilterEmployeeId] = useState('')
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [editingAttendance, setEditingAttendance] = useState<AttendanceWithEmployee | null>(null)

  // レポート
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1)
  const [reportData, setReportData] = useState<ReportData | null>(null)

  // メッセージ
  const [message, setMessage] = useState({ text: '', type: '' })

  // パスワード変更モーダル
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState({ text: '', type: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)

  // 認証チェック
  useEffect(() => {
    const auth = sessionStorage.getItem('admin_authenticated')
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  // 認証処理
  const handleLogin = async () => {
    setAuthError('')
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (res.ok) {
        sessionStorage.setItem('admin_authenticated', 'true')
        setIsAuthenticated(true)
      } else {
        const data = await res.json()
        setAuthError(data.error || '認証に失敗しました')
      }
    } catch {
      setAuthError('エラーが発生しました')
    }
  }

  // データ取得
  useEffect(() => {
    if (isAuthenticated) {
      fetchEmployees()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && activeTab === 'attendance') {
      fetchAttendance()
    }
  }, [isAuthenticated, activeTab, filterEmployeeId, filterStartDate, filterEndDate])

  useEffect(() => {
    if (isAuthenticated && activeTab === 'reports') {
      fetchReport()
    }
  }, [isAuthenticated, activeTab, reportYear, reportMonth])

  // 従業員一覧取得
  const fetchEmployees = async () => {
    const res = await fetch('/api/employees?include_inactive=true')
    const data = await res.json()
    if (Array.isArray(data)) {
      setEmployees(data)
    }
  }

  // 勤怠記録取得
  const fetchAttendance = async () => {
    const params = new URLSearchParams()
    if (filterEmployeeId) params.append('employee_id', filterEmployeeId)
    if (filterStartDate) params.append('start_date', filterStartDate)
    if (filterEndDate) params.append('end_date', filterEndDate)

    const res = await fetch(`/api/attendance?${params}`)
    const data = await res.json()
    if (Array.isArray(data)) {
      setAttendanceRecords(data)
    }
  }

  // レポート取得
  const fetchReport = async () => {
    const res = await fetch(`/api/reports?year=${reportYear}&month=${reportMonth}`)
    const data = await res.json()
    if (data.summary) {
      setReportData(data)
    }
  }

  // 従業員追加
  const handleAddEmployee = async () => {
    if (!newEmployeeName.trim()) return

    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newEmployeeName })
    })

    if (res.ok) {
      setNewEmployeeName('')
      fetchEmployees()
      showMessage('従業員を追加しました', 'success')
    } else {
      showMessage('追加に失敗しました', 'error')
    }
  }

  // 従業員更新
  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return

    const res = await fetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingEmployee)
    })

    if (res.ok) {
      setEditingEmployee(null)
      fetchEmployees()
      showMessage('従業員を更新しました', 'success')
    } else {
      showMessage('更新に失敗しました', 'error')
    }
  }

  // 従業員削除（無効化）
  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('この従業員を無効化しますか？')) return

    const res = await fetch(`/api/employees?id=${id}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      fetchEmployees()
      showMessage('従業員を無効化しました', 'success')
    } else {
      showMessage('無効化に失敗しました', 'error')
    }
  }

  // 従業員完全削除
  const handlePermanentDeleteEmployee = async (id: string) => {
    if (!confirm('この従業員を完全に削除しますか？この操作は取り消せません。')) return

    const res = await fetch(`/api/employees?id=${id}&permanent=true`, {
      method: 'DELETE'
    })

    if (res.ok) {
      fetchEmployees()
      showMessage('従業員を完全に削除しました', 'success')
    } else {
      showMessage('削除に失敗しました', 'error')
    }
  }

  // 勤怠記録更新
  const handleUpdateAttendance = async () => {
    if (!editingAttendance) return

    const res = await fetch('/api/attendance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingAttendance.id,
        work_date: editingAttendance.work_date,
        clock_in: editingAttendance.clock_in,
        clock_out: editingAttendance.clock_out,
        note: editingAttendance.note
      })
    })

    if (res.ok) {
      setEditingAttendance(null)
      fetchAttendance()
      showMessage('記録を更新しました', 'success')
    } else {
      showMessage('更新に失敗しました', 'error')
    }
  }

  // 勤怠記録削除
  const handleDeleteAttendance = async (id: string) => {
    if (!confirm('この記録を削除しますか？')) return

    const res = await fetch(`/api/attendance?id=${id}`, {
      method: 'DELETE'
    })

    if (res.ok) {
      fetchAttendance()
      showMessage('記録を削除しました', 'success')
    } else {
      showMessage('削除に失敗しました', 'error')
    }
  }

  // CSV出力
  const handleExportCSV = async () => {
    window.open(`/api/reports?year=${reportYear}&month=${reportMonth}&format=csv`, '_blank')
  }

  // メッセージ表示
  const showMessage = (text: string, type: string) => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 3000)
  }

  // パスワード変更処理
  const handleChangePassword = async () => {
    setPasswordMessage({ text: '', type: '' })

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ text: '全ての項目を入力してください', type: 'error' })
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: '新しいパスワードが一致しません', type: 'error' })
      return
    }

    if (newPassword.length < 4) {
      setPasswordMessage({ text: 'パスワードは4文字以上で入力してください', type: 'error' })
      return
    }

    setPasswordLoading(true)

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      const data = await res.json()

      if (res.ok) {
        setPasswordMessage({ text: 'パスワードを変更しました', type: 'success' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => {
          setShowPasswordModal(false)
          setPasswordMessage({ text: '', type: '' })
        }, 2000)
      } else {
        setPasswordMessage({ text: data.error || '変更に失敗しました', type: 'error' })
      }
    } catch {
      setPasswordMessage({ text: 'エラーが発生しました', type: 'error' })
    } finally {
      setPasswordLoading(false)
    }
  }

  // パスワードモーダルを閉じる
  const closePasswordModal = () => {
    setShowPasswordModal(false)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMessage({ text: '', type: '' })
  }

  // 時刻フォーマット（日本時間で表示）
  const formatTimeOnly = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo'
    })
  }

  // ISO文字列 → datetime-local用の値（JST表示）
  const toDatetimeLocalValue = (isoString: string) => {
    const date = new Date(isoString)
    const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
    return jst.toISOString().slice(0, 16)
  }

  // datetime-localの値 → JSTオフセット付きISO文字列
  const fromDatetimeLocalValue = (localValue: string) => {
    return localValue + ':00+09:00'
  }

  // 認証画面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-gray-800 text-center mb-6">管理画面</h1>
          <div className="space-y-4">
            <input
              type="password"
              placeholder="パスワードを入力"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            {authError && (
              <p className="text-red-600 text-sm text-center">{authError}</p>
            )}
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors"
            >
              ログイン
            </button>
            <Link
              href="/"
              className="block text-center text-gray-500 hover:text-gray-700 text-sm"
            >
              ← 打刻画面に戻る
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">管理画面</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="パスワード変更"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">
              ← 打刻画面
            </Link>
          </div>
        </div>
      </header>

      {/* タブ */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex space-x-1 bg-gray-200 rounded-lg p-1">
          {[
            { key: 'employees', label: '従業員管理' },
            { key: 'attendance', label: '勤怠記録' },
            { key: 'reports', label: '月次レポート' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as Tab)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* メッセージ */}
      {message.text && (
        <div className="max-w-6xl mx-auto px-4">
          <div className={`p-3 rounded-lg text-center text-sm font-medium border ${
            message.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-green-50 text-green-700 border-green-200'
          }`}>
            {message.text}
          </div>
        </div>
      )}

      {/* コンテンツ */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* 従業員管理タブ */}
        {activeTab === 'employees' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">従業員管理</h2>

            {/* 追加フォーム */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                placeholder="新規従業員名"
                className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newEmployeeName}
                onChange={(e) => setNewEmployeeName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddEmployee()}
              />
              <button
                onClick={handleAddEmployee}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                追加
              </button>
            </div>

            {/* 従業員一覧 */}
            <div className="space-y-2">
              {employees.map(emp => (
                <div
                  key={emp.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    emp.is_active ? 'border-gray-200' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {editingEmployee?.id === emp.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={editingEmployee.name}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                      />
                      <button
                        onClick={handleUpdateEmployee}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditingEmployee(null)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className={emp.is_active ? 'text-gray-800' : 'text-gray-400'}>
                          {emp.name}
                        </span>
                        {!emp.is_active && (
                          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded">
                            無効
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={() => setEditingEmployee(emp)}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          編集
                        </button>
                        {emp.is_active ? (
                          <button
                            onClick={() => handleDeleteEmployee(emp.id)}
                            className="text-gray-500 hover:text-gray-700 text-sm"
                          >
                            無効化
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePermanentDeleteEmployee(emp.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 勤怠記録タブ */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">勤怠記録</h2>

            {/* フィルター */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <select
                className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
              >
                <option value="">全従業員</option>
                {employees.filter(e => e.is_active).map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
              <input
                type="date"
                className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
              />
              <input
                type="date"
                className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
              />
              <button
                onClick={() => {
                  setFilterEmployeeId('')
                  setFilterStartDate('')
                  setFilterEndDate('')
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
              >
                クリア
              </button>
            </div>

            {/* 記録一覧 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">日付</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">従業員</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">シフト</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">出勤</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">退勤</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">休憩</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">労働</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">状態</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map(record => (
                    <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2">{record.work_date}</td>
                      <td className="py-2 px-2">{record.employees?.name || '-'}</td>
                      <td className="py-2 px-2">{record.shift_number}</td>
                      <td className="py-2 px-2">{formatTimeOnly(record.clock_in)}</td>
                      <td className="py-2 px-2">{record.clock_out ? formatTimeOnly(record.clock_out) : '-'}</td>
                      <td className="py-2 px-2">{record.break_minutes}分</td>
                      <td className="py-2 px-2">{formatMinutesJapanese(record.work_minutes)}</td>
                      <td className="py-2 px-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          record.status === 'working'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {record.status === 'working' ? '勤務中' : '完了'}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex gap-4">
                          <button
                            onClick={() => setEditingAttendance(record)}
                            className="text-gray-600 hover:text-gray-800 text-xs"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteAttendance(record.id)}
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {attendanceRecords.length === 0 && (
                <p className="text-center text-gray-400 py-8">記録がありません</p>
              )}
            </div>
          </div>
        )}

        {/* 月次レポートタブ */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">月次レポート</h2>

              {/* 期間選択 */}
              <div className="flex gap-4 mb-6">
                <select
                  className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                >
                  {[...Array(5)].map((_, i) => {
                    const year = new Date().getFullYear() - i
                    return <option key={year} value={year}>{year}年</option>
                  })}
                </select>
                <select
                  className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}月</option>
                  ))}
                </select>
                <button
                  onClick={handleExportCSV}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  CSV出力
                </button>
              </div>

              {/* サマリー */}
              {reportData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                    <div className="text-2xl font-bold text-gray-800">
                      {reportData.summary.totalWorkHours}
                    </div>
                    <div className="text-sm text-gray-600">総労働時間</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                    <div className="text-2xl font-bold text-gray-800">
                      {reportData.summary.activeEmployees}
                    </div>
                    <div className="text-sm text-gray-600">稼働人数</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                    <div className="text-2xl font-bold text-gray-800">
                      {reportData.summary.totalRecords}
                    </div>
                    <div className="text-sm text-gray-600">総レコード数</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                    <div className="text-2xl font-bold text-gray-800">
                      {reportData.employees.length > 0
                        ? Math.round(reportData.summary.totalWorkHours / reportData.employees.length)
                        : 0}
                    </div>
                    <div className="text-sm text-gray-600">平均労働時間</div>
                  </div>
                </div>
              )}
            </div>

            {/* 従業員別集計 */}
            {reportData && reportData.employees.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-md font-bold text-gray-800 mb-4">従業員別集計</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 font-medium text-gray-600">従業員</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-600">勤務日数</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-600">シフト数</th>
                        <th className="text-right py-2 px-2 font-medium text-gray-600">総労働時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.employees.map(emp => (
                        <tr key={emp.id} className="border-b border-gray-100">
                          <td className="py-2 px-2">{emp.name}</td>
                          <td className="py-2 px-2 text-right">{emp.totalDays}日</td>
                          <td className="py-2 px-2 text-right">{emp.records}回</td>
                          <td className="py-2 px-2 text-right">
                            {emp.totalWorkHours}時間{emp.totalWorkMinutesRemainder}分
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editingAttendance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-4">勤怠記録の編集</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">日付</label>
                <input
                  type="date"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editingAttendance.work_date}
                  onChange={(e) => setEditingAttendance({ ...editingAttendance, work_date: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">出勤時刻</label>
                <input
                  type="datetime-local"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={toDatetimeLocalValue(editingAttendance.clock_in)}
                  onChange={(e) => setEditingAttendance({ ...editingAttendance, clock_in: fromDatetimeLocalValue(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">退勤時刻</label>
                <input
                  type="datetime-local"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editingAttendance.clock_out ? toDatetimeLocalValue(editingAttendance.clock_out) : ''}
                  onChange={(e) => setEditingAttendance({ ...editingAttendance, clock_out: e.target.value ? fromDatetimeLocalValue(e.target.value) : null })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">備考</label>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={editingAttendance.note || ''}
                  onChange={(e) => setEditingAttendance({ ...editingAttendance, note: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleUpdateAttendance}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditingAttendance(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* パスワード変更モーダル */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-4">管理パスワード変更</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  現在のパスワード
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  新しいパスワード
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  新しいパスワード（確認）
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {passwordMessage.text && (
                <div className={`p-3 rounded-lg text-sm text-center ${
                  passwordMessage.type === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {passwordMessage.text}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closePasswordModal}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={passwordLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {passwordLoading ? '処理中...' : '変更する'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

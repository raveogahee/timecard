// 従業員
export interface Employee {
  id: string  // UUID
  name: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// 勤怠記録
export interface Attendance {
  id: string  // UUID
  employee_id: string
  work_date: string
  shift_number: number
  clock_in: string
  clock_out: string | null
  break_minutes: number
  work_minutes: number
  is_overnight: boolean
  status: 'working' | 'completed'
  note: string | null
  created_at?: string
  updated_at?: string
}

// 打刻ログ
export interface PunchLog {
  id: string
  employee_id: string
  punch_type: 'clock_in' | 'clock_out'
  punch_time: string
  created_at?: string
}

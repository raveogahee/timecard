import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

// パスワード検証
export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (!password) {
    return NextResponse.json({ error: 'パスワードが必要です' }, { status: 400 })
  }

  // まずDBからハッシュ化パスワードを取得
  const { data: setting } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'admin_password_hash')
    .maybeSingle()

  if (setting?.value) {
    // DBにハッシュがある場合はbcryptで比較
    const isValid = await bcrypt.compare(password, setting.value)
    if (isValid) {
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'パスワードが正しくありません' }, { status: 401 })
  }

  // DBにない場合はenvにフォールバック（移行期間用）
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return NextResponse.json({ error: '管理パスワードが設定されていません' }, { status: 500 })
  }

  if (password === adminPassword) {
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'パスワードが正しくありません' }, { status: 401 })
}

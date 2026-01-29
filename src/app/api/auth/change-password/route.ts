import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

// パスワード変更
export async function POST(request: NextRequest) {
  const { currentPassword, newPassword } = await request.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '現在のパスワードと新しいパスワードが必要です' }, { status: 400 })
  }

  if (newPassword.length < 4) {
    return NextResponse.json({ error: 'パスワードは4文字以上で入力してください' }, { status: 400 })
  }

  // 現在のパスワードを検証
  const { data: setting, error: fetchError } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'admin_password_hash')
    .maybeSingle()

  if (fetchError) {
    console.error('Settings fetch error:', fetchError)
    // テーブルが存在しない場合もenvにフォールバック
  }

  let isCurrentValid = false

  if (setting?.value) {
    // DBにハッシュがある場合はbcryptで比較
    isCurrentValid = await bcrypt.compare(currentPassword, setting.value)
  } else {
    // DBにない場合はenvと比較
    const adminPassword = process.env.ADMIN_PASSWORD
    isCurrentValid = currentPassword === adminPassword
  }

  if (!isCurrentValid) {
    return NextResponse.json({ error: '現在のパスワードが正しくありません' }, { status: 401 })
  }

  // 新しいパスワードをハッシュ化
  const saltRounds = 10
  const hashedPassword = await bcrypt.hash(newPassword, saltRounds)

  // DBに保存（upsert）
  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'admin_password_hash',
      value: hashedPassword
    }, {
      onConflict: 'key'
    })

  if (error) {
    console.error('Password save error:', error)
    return NextResponse.json({ error: `パスワードの保存に失敗しました: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'パスワードを変更しました' })
}

import { NextRequest, NextResponse } from 'next/server'

// パスワード検証
export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (!password) {
    return NextResponse.json({ error: 'パスワードが必要です' }, { status: 400 })
  }

  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    return NextResponse.json({ error: '管理パスワードが設定されていません' }, { status: 500 })
  }

  if (password === adminPassword) {
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'パスワードが正しくありません' }, { status: 401 })
}

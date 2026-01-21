import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 従業員一覧取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const includeInactive = searchParams.get('include_inactive') === 'true'

  let query = supabase
    .from('employees')
    .select('*')
    .order('name')

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// 従業員追加
export async function POST(request: NextRequest) {
  const { name } = await request.json()

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '名前が必要です' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('employees')
    .insert({ name: name.trim() })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// 従業員更新
export async function PUT(request: NextRequest) {
  const { id, name, is_active } = await request.json()

  if (!id) {
    return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
  }

  const updateData: { name?: string; is_active?: boolean; updated_at: string } = {
    updated_at: new Date().toISOString()
  }

  if (name !== undefined) updateData.name = name.trim()
  if (is_active !== undefined) updateData.is_active = is_active

  const { data, error } = await supabase
    .from('employees')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// 従業員削除（論理削除 or 完全削除）
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const permanent = searchParams.get('permanent') === 'true'

  if (!id) {
    return NextResponse.json({ error: 'IDが必要です' }, { status: 400 })
  }

  if (permanent) {
    // 完全削除（物理削除）- 無効な従業員のみ許可
    const { data: employee } = await supabase
      .from('employees')
      .select('is_active')
      .eq('id', id)
      .single()

    if (employee?.is_active) {
      return NextResponse.json({ error: '有効な従業員は完全削除できません。先に無効化してください。' }, { status: 400 })
    }

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '完全に削除しました' })
  } else {
    // 論理削除
    const { data, error } = await supabase
      .from('employees')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  }
}

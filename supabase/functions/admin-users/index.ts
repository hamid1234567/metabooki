import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeEmail(email: unknown) {
  return String(email || '').trim().toLowerCase()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Unauthorized')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: auth } = await userClient.auth.getUser()
    const requester = auth.user
    if (!requester) throw new Error('Unauthorized')

    const { data: role } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requester.id)
      .in('role', ['admin', 'super_admin'])
      .limit(1)
    if (!role?.length) throw new Error('Admin access required')

    const body = await req.json()
    const operation = body.operation

    if (operation === 'list_users') {
      const { data: users, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (error) throw error
      const userIds = users.users.map(user => user.id)
      const { data: profiles } = await adminClient.from('profiles').select('id,display_name').in('id', userIds)
      const { data: roles } = await adminClient.from('user_roles').select('user_id,role').in('user_id', userIds)
      const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile.display_name]))
      const roleMap = new Map<string, string[]>()
      for (const item of roles || []) {
        const current = roleMap.get(item.user_id) || []
        current.push(item.role)
        roleMap.set(item.user_id, current)
      }
      return new Response(JSON.stringify({
        users: users.users.map(user => ({
          id: user.id,
          email: user.email,
          displayName: profileMap.get(user.id) || user.user_metadata?.display_name || '',
          roles: roleMap.get(user.id) || [],
          lastSignInAt: user.last_sign_in_at,
          createdAt: user.created_at,
        })),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (operation === 'set_password') {
      const email = normalizeEmail(body.email)
      const password = String(body.password || '')
      if (!email) throw new Error('Email is required')
      if (password.length < 8) throw new Error('Password must be at least 8 characters')
      const { data: users, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (listError) throw listError
      const target = users.users.find(user => normalizeEmail(user.email) === email)
      if (!target) throw new Error('User not found')
      const { error } = await adminClient.auth.admin.updateUserById(target.id, { password })
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (operation === 'send_reset') {
      const email = normalizeEmail(body.email)
      if (!email) throw new Error('Email is required')
      const redirectTo = String(body.redirectTo || `${req.headers.get('origin') || ''}/auth`)
      const { data, error } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      })
      if (error) throw error
      return new Response(JSON.stringify({ ok: true, actionLink: data?.properties?.action_link || '' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error('Unknown operation')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Admin users operation failed'
    return new Response(JSON.stringify({ error: message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

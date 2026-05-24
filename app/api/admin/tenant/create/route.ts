import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin-config'

async function ownerAuth() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? '')) return null
  return user
}

export async function POST(req: NextRequest) {
  const owner = await ownerAuth()
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { company, admin, modules } = body

  // Validate required fields
  if (!company?.nom_entreprise || !company?.email_contact) {
    return NextResponse.json({ error: 'Nom entreprise et email obligatoires' }, { status: 400 })
  }
  if (!admin?.email || !admin?.password) {
    return NextResponse.json({ error: 'Email et mot de passe admin obligatoires' }, { status: 400 })
  }
  if (admin.password.length < 8) {
    return NextResponse.json({ error: 'Mot de passe trop court (8 caractères min)' }, { status: 400 })
  }

  // Step 1 — Check admin email not already in use
  const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
  const emailTaken = existingUser?.users.some(u => u.email === admin.email)
  if (emailTaken) {
    return NextResponse.json({ error: `Email ${admin.email} déjà utilisé` }, { status: 409 })
  }

  // Step 2 — Create tenant
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .insert({
      nom_entreprise:  company.nom_entreprise,
      plan:            company.plan ?? 'starter',
      modules_actifs:  modules ?? [],
      status:          'active',
      // Additional info stored as json in metadata if table supports it
      // (secteur, pays, ville, telephone, email_contact, devise, logo_url)
    })
    .select()
    .single()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: tenantError?.message ?? 'Erreur création tenant' }, { status: 500 })
  }

  // Step 3 — Create Supabase auth user
  const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email:             admin.email,
    password:          admin.password,
    email_confirm:     true,
    user_metadata: {
      full_name: `${admin.prenom ?? ''} ${admin.nom ?? ''}`.trim(),
    },
  })

  if (userError || !newUser?.user) {
    // Rollback: delete tenant
    await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
    return NextResponse.json({ error: userError?.message ?? 'Erreur création utilisateur' }, { status: 500 })
  }

  // Step 4 — Create profile (owner role for the company)
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      user_id:   newUser.user.id,
      tenant_id: tenant.id,
      role:      'owner',
    })

  if (profileError) {
    // Partial rollback
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
    await supabaseAdmin.from('tenants').delete().eq('id', tenant.id)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Step 5 — Try to send invitation email via Resend (non-blocking)
  try {
    const emailBody = {
      from:    'Oraforme <noreply@oraforms.com>',
      to:      [admin.email],
      subject: `Bienvenue sur Oraforme — Accès à ${company.nom_entreprise}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px">
          <h2 style="color:#F59E0B">Bienvenue sur Oraforme !</h2>
          <p>Votre espace entreprise <strong>${company.nom_entreprise}</strong> a été créé.</p>
          <p><strong>Vos identifiants :</strong></p>
          <ul>
            <li>Email : ${admin.email}</li>
            <li>Mot de passe : (celui que vous avez défini)</li>
          </ul>
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.oraforms.com'}/login"
             style="display:inline-block;background:#F59E0B;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">
            Accéder à mon espace
          </a>
          <p style="color:#9CA3AF;font-size:12px;margin-top:24px">
            Modules activés : ${(modules ?? []).join(', ') || 'Aucun'}
          </p>
        </div>
      `,
    }

    if (process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailBody),
      })
    }
  } catch {
    // Email failure is non-blocking — tenant + user are created
  }

  return NextResponse.json(
    {
      success:  true,
      tenantId: tenant.id,
      userId:   newUser.user.id,
      message:  `Entreprise ${company.nom_entreprise} créée avec succès`,
    },
    { status: 201 },
  )
}

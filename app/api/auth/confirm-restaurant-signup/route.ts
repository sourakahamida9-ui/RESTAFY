import { NextRequest, NextResponse } from 'next/server';
import {
  confirmUserEmailViaGoTrue,
  createServiceRoleClient,
  getAuthAdmin,
  getServiceRoleKeyForServer,
  getSupabaseUrlForServer,
} from '../../../../api/auth/supabaseAuthAdmin';

/**
 * Confirme l’e-mail d’un compte fraîchement créé (client ou restaurant_owner).
 * Sécurité : userId + email + rôle attendu + metadata + création récente.
 * (Parité avec api/auth/confirm-restaurant-signup.ts — utile si le projet utilise App Router.)
 */
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

function metadataRoleMatchesExpected(
  meta: Record<string, unknown> | undefined,
  expected: 'client' | 'restaurant_owner',
): boolean {
  const roleStr = typeof meta?.role === 'string' ? meta.role.trim() : '';
  if (expected === 'client') {
    return roleStr === '' || roleStr === 'client';
  }
  return roleStr === 'restaurant_owner' || roleStr === 'restaurant';
}

export async function POST(req: NextRequest) {
  const url = getSupabaseUrlForServer();
  const key = getServiceRoleKeyForServer();
  if (!url || !key) {
    return NextResponse.json(
      {
        error:
          'Configuration serveur : SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY requis.',
      },
      { status: 500 },
    );
  }

  const supabaseAdmin = createServiceRoleClient(url, key);
  const authAdmin = getAuthAdmin(supabaseAdmin);

  try {
    const body = (await req.json()) as {
      userId?: string;
      email?: string;
      /** défaut : restaurant_owner (rétrocompat) */
      expectedRole?: 'client' | 'restaurant_owner';
    };
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const expectedRole: 'client' | 'restaurant_owner' =
      body.expectedRole === 'client' ? 'client' : 'restaurant_owner';

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId et email requis' }, { status: 400 });
    }

    const { data: got, error: getErr } = await authAdmin.getUserById(userId);
    if (getErr || !got.user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const user = got.user;
    if ((user.email || '').toLowerCase() !== email) {
      return NextResponse.json({ error: 'Email ne correspond pas à ce compte' }, { status: 403 });
    }

    const meta = user.user_metadata as Record<string, unknown> | undefined;
    if (!metadataRoleMatchesExpected(meta, expectedRole)) {
      return NextResponse.json({ error: 'Rôle non autorisé pour cette opération' }, { status: 403 });
    }

    if (user.email_confirmed_at) {
      const fullNameEarly =
        typeof meta?.full_name === 'string' ? meta.full_name.trim() : '';
      const phoneEarly = typeof meta?.phone === 'string' ? meta.phone.trim() : '';
      const rowEarly = {
        id: userId,
        full_name: fullNameEarly || email.split('@')[0],
        phone: phoneEarly || null,
        role: expectedRole,
        email,
        updated_at: new Date().toISOString(),
      };
      const { error: profEarly } = await supabaseAdmin.from('profiles').upsert(rowEarly, { onConflict: 'id' });
      if (profEarly && process.env.NODE_ENV !== 'production') {
        console.error('[confirm-restaurant-signup] profile upsert (alreadyConfirmed):', profEarly);
      }
      return NextResponse.json({ ok: true, alreadyConfirmed: true });
    }

    const created = user.created_at ? new Date(user.created_at).getTime() : 0;
    if (!created || Date.now() - created > MAX_AGE_MS) {
      return NextResponse.json(
        {
          error:
            'Délai d’inscription dépassé. Utilisez le lien reçu par e-mail ou recommencez l’inscription.',
        },
        { status: 403 },
      );
    }

    const { error: updErr } = await authAdmin.updateUserById(userId, {
      email_confirm: true,
    });

    if (updErr) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[confirm-restaurant-signup] updateUserById:', updErr);
      }
      const rest = await confirmUserEmailViaGoTrue(url, key, userId);
      if (rest.error) {
        return NextResponse.json(
          {
            error: `Confirmation e-mail (SDK + API GoTrue) : ${updErr.message} | ${rest.error}`,
          },
          { status: 500 },
        );
      }
    }

    const fullName =
      typeof meta?.full_name === 'string' ? meta.full_name.trim() : '';
    const phoneMeta = typeof meta?.phone === 'string' ? meta.phone.trim() : '';
    const profileRow = {
      id: userId,
      full_name: fullName || email.split('@')[0],
      phone: phoneMeta || null,
      role: expectedRole,
      email,
      updated_at: new Date().toISOString(),
    };
    const { error: profErr } = await supabaseAdmin.from('profiles').upsert(profileRow, { onConflict: 'id' });
    if (profErr && process.env.NODE_ENV !== 'production') {
      console.error('[confirm-restaurant-signup] profile upsert:', profErr);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[confirm-restaurant-signup]', e);
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

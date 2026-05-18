import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Crée un utilisateur avec e-mail déjà confirmé (aucun e-mail transactionnel Supabase).
 * Contourne les limites d’envoi d’e-mails (ex. « email rate limit exceeded ») sur signUp classique.
 */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error:
            'Configuration serveur : définissez NEXT_PUBLIC_SUPABASE_URL (ou SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 },
      );
    }

    const body = (await req.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
      role?: string;
      restaurantName?: string;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const role = body.role === 'restaurant_owner' ? 'restaurant_owner' : 'client';
    const restaurantName =
      typeof body.restaurantName === 'string' ? body.restaurantName.trim() : undefined;

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail et mot de passe requis' }, { status: 400 });
    }
    if (!fullName || !phone) {
      return NextResponse.json({ error: 'Nom complet et numéro de téléphone requis' }, { status: 400 });
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        {
          error:
            'Mot de passe trop faible : au moins 8 caractères, avec au moins une lettre et un chiffre.',
        },
        { status: 400 },
      );
    }
    if (role === 'restaurant_owner' && !restaurantName) {
      return NextResponse.json({ error: 'Le nom du restaurant est requis pour un compte partenaire' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || undefined,
        phone: phone || undefined,
        role,
        restaurant_name: role === 'restaurant_owner' ? restaurantName || undefined : undefined,
      },
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      const raw = error.message || '';
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json(
          { error: 'Cette adresse e-mail est déjà utilisée. Essayez de vous connecter.' },
          { status: 409 },
        );
      }
      if (msg.includes('weak') || msg.includes('password') || msg.includes('least')) {
        return NextResponse.json(
          {
            error:
              'Mot de passe refusé : utilisez au moins 8 caractères avec des lettres et des chiffres.',
          },
          { status: 400 },
        );
      }
      if (
        msg.includes('database') ||
        msg.includes('trigger') ||
        msg.includes('saving new user') ||
        msg.includes('unexpected_failure')
      ) {
        return NextResponse.json(
          {
            error:
              `Échec côté base (souvent téléphone déjà utilisé ou déclencheur profil). Détail : ${raw}`,
          },
          { status: 422 },
        );
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error('[register-confirmed] createUser:', error);
      }
      return NextResponse.json(
        { error: raw || 'Impossible de créer le compte' },
        { status: 400 },
      );
    }

    if (!data.user?.id) {
      return NextResponse.json(
        { error: 'Création du compte : réponse Auth sans identifiant utilisateur' },
        { status: 500 },
      );
    }

    const userId = data.user.id;
    const profileRow = {
      id: userId,
      full_name: fullName || email.split('@')[0],
      phone: phone || null,
      role,
      email,
      updated_at: new Date().toISOString(),
    };
    let { error: profErr } = await supabaseAdmin.from('profiles').upsert(profileRow, { onConflict: 'id' });
    const phoneConflict =
      profErr &&
      (profErr.code === '23505' ||
        String(profErr.message || '')
          .toLowerCase()
          .includes('phone'));
    if (phoneConflict) {
      const { error: retryErr } = await supabaseAdmin
        .from('profiles')
        .upsert({ ...profileRow, phone: null }, { onConflict: 'id' });
      if (retryErr && process.env.NODE_ENV !== 'production') {
        console.error('[register-confirmed] profile upsert (retry sans téléphone):', retryErr);
      } else profErr = null;
    }
    if (profErr && process.env.NODE_ENV !== 'production') {
      console.error('[register-confirmed] profile upsert:', profErr);
    }

    if (role === 'restaurant_owner' && restaurantName) {
      const { data: prof, error: profReadErr } = await supabaseAdmin
        .from('profiles')
        .select('restaurant_id')
        .eq('id', userId)
        .maybeSingle();
      if (profReadErr && process.env.NODE_ENV !== 'production') {
        console.error('[register-confirmed] profile read:', profReadErr);
      } else if (!prof?.restaurant_id) {
        const slug = `${restaurantName
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')}-${Date.now().toString(36)}`;

        const { data: resto, error: restoErr } = await supabaseAdmin
          .from('restaurants')
          .insert([
            {
              name: restaurantName.trim(),
              slug,
              owner_id: userId,
              is_active: true,
              is_open: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select('id')
          .single();

        if (restoErr && process.env.NODE_ENV !== 'production') {
          console.error('[register-confirmed] restaurant insert:', restoErr);
        } else if (resto?.id) {
          const { error: linkErr } = await supabaseAdmin
            .from('profiles')
            .update({ restaurant_id: resto.id })
            .eq('id', userId);
          if (linkErr && process.env.NODE_ENV !== 'production') {
            console.error('[register-confirmed] profile restaurant_id:', linkErr);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, userId });
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[register-confirmed]', e);
    }
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Erreur serveur register-confirmed : ${detail}`.slice(0, 500) },
      { status: 500 },
    );
  }
}

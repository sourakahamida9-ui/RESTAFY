/**
 * Même logique que app/api/auth/register-confirmed
 * Déployer : supabase functions deploy register-confirmed --no-verify-jwt
 */
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({
          error:
            'Configuration serveur : définissez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (secrets de la fonction register-confirmed sur Supabase).',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body: {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
      role?: string;
      restaurantName?: string;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return new Response(JSON.stringify({ error: 'Corps JSON invalide' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const role = body.role === 'restaurant_owner' ? 'restaurant_owner' : 'client';
    const restaurantName =
      typeof body.restaurantName === 'string' ? body.restaurantName.trim() : undefined;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'E-mail et mot de passe requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!fullName || !phone) {
      return new Response(JSON.stringify({ error: 'Nom complet et téléphone requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return new Response(
        JSON.stringify({
          error:
            'Mot de passe trop faible : au moins 8 caractères, avec au moins une lettre et un chiffre.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (role === 'restaurant_owner' && !restaurantName) {
      return new Response(JSON.stringify({ error: 'Le nom du restaurant est requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await admin.auth.admin.createUser({
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
      const raw = error.message ?? '';
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return new Response(
          JSON.stringify({
            error: 'Cette adresse e-mail est déjà utilisée. Essayez de vous connecter.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (msg.includes('weak') || msg.includes('password') || msg.includes('least')) {
        return new Response(
          JSON.stringify({
            error:
              'Mot de passe refusé : utilisez au moins 8 caractères avec des lettres et des chiffres.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (
        msg.includes('database') ||
        msg.includes('trigger') ||
        msg.includes('saving new user') ||
        msg.includes('unexpected_failure')
      ) {
        return new Response(
          JSON.stringify({
            error:
              `Échec côté base (souvent téléphone déjà utilisé ou rôle invalide dans le déclencheur). Détail : ${raw}`,
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ error: raw || 'Impossible de créer le compte' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Création du compte : réponse Auth sans identifiant utilisateur' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
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
    let { error: profErr } = await admin.from('profiles').upsert(profileRow, { onConflict: 'id' });
    const phoneConflict =
      profErr &&
      (profErr.code === '23505' ||
        String(profErr.message || '')
          .toLowerCase()
          .includes('phone'));
    if (phoneConflict) {
      const { error: retryErr } = await admin
        .from('profiles')
        .upsert({ ...profileRow, phone: null }, { onConflict: 'id' });
      if (retryErr) console.error('[register-confirmed] profile upsert (retry sans téléphone):', retryErr);
      else profErr = null;
    }
    if (profErr) {
      console.error('[register-confirmed] profile upsert:', profErr);
    }

    // Même logique que useAuth.createRestaurantForUser — évite le cycle RLS côté client
    if (role === 'restaurant_owner' && restaurantName) {
      const { data: prof, error: profReadErr } = await admin
        .from('profiles')
        .select('restaurant_id')
        .eq('id', userId)
        .maybeSingle();
      if (profReadErr) {
        console.error('[register-confirmed] profile read:', profReadErr);
      } else if (!prof?.restaurant_id) {
        const slug = `${restaurantName
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')}-${Date.now().toString(36)}`;

        const { data: resto, error: restoErr } = await admin
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

        if (restoErr) {
          console.error('[register-confirmed] restaurant insert:', restoErr);
        } else if (resto?.id) {
          const { error: linkErr } = await admin
            .from('profiles')
            .update({ restaurant_id: resto.id })
            .eq('id', userId);
          if (linkErr) {
            console.error('[register-confirmed] profile restaurant_id:', linkErr);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, userId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[register-confirmed]', e);
    const detail = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({
        error: `Erreur serveur register-confirmed : ${detail}`.slice(0, 500),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

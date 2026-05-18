import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin as getMemoizedSupabaseAdmin } from './_shared/supabaseAdmin';
import { checkRateLimit, getClientIp } from './_shared/rateLimit';
import { applyCors } from './_shared/cors';

type TeamScanAccess = {
  tokenId: string;
  restaurantId: string;
  restaurantName: string | null;
  memberName: string;
  memberRole: string;
  canUpdateOrderStatus: boolean;
  canCancelOrder: boolean;
};

type TeamScanValidationResult =
  | { ok: true; access: TeamScanAccess }
  | { ok: false; status: number; error: string };

const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed',
  accepted: 'preparing',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivering',
  delivering: 'delivered',
};

const ALLOWED_STATUSES = new Set([
  'pending',
  'accepted',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'cancelled',
]);

class ServerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerConfigError';
  }
}

function getSupabaseAdmin() {
  // Validation explicite avec messages dédiés, puis client mémoizé.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new ServerConfigError(
      'Configuration serveur incomplète (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY manquants).'
    );
  }
  if (key.length < 40) {
    throw new ServerConfigError(
      'Configuration serveur invalide (SUPABASE_SERVICE_ROLE_KEY trop court).'
    );
  }
  return getMemoizedSupabaseAdmin();
}

function mapSupabaseError(error: { message?: string; code?: string; status?: number }): {
  status: number;
  error: string;
} {
  const msg = String(error?.message || '').toLowerCase();
  if (msg.includes('invalid api key') || msg.includes('jwt') || msg.includes('unauthorized')) {
    return {
      status: 500,
      error:
        "Configuration serveur invalide (clé Supabase côté serveur rejetée). Contactez l'administrateur.",
    };
  }
  return { status: 500, error: error?.message || 'Erreur base de données' };
}

async function readBody(req: VercelRequest): Promise<any> {
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body || {};
}

async function validateTeamScanAccess(
  token: string,
  pin: string,
  options?: { touchUsage?: boolean }
): Promise<TeamScanValidationResult> {
  const cleanToken = token.trim();
  const cleanPin = pin.replace(/\D/g, '');
  if (!cleanToken) return { ok: false, status: 400, error: 'Token requis' };
  if (cleanPin.length < 4) return { ok: false, status: 400, error: 'PIN invalide' };

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('team_scan_tokens')
    .select('id, restaurant_id, member_name, member_role, pin, is_active, expires_at, usage_count')
    .eq('token', cleanToken)
    .maybeSingle();

  if (error) return { ok: false, ...mapSupabaseError(error) };
  if (!data) return { ok: false, status: 404, error: 'Lien invalide' };
  if (!data.is_active) return { ok: false, status: 403, error: 'Accès désactivé' };
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return { ok: false, status: 403, error: 'Accès expiré' };
  }
  if (String(data.pin || '').trim() !== cleanPin) {
    return { ok: false, status: 401, error: 'PIN incorrect' };
  }

  if (options?.touchUsage) {
    await supabase
      .from('team_scan_tokens')
      .update({
        usage_count: Number(data.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', data.id);
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name')
    .eq('id', data.restaurant_id)
    .maybeSingle();

  const role = String(data.member_role || 'staff').toLowerCase();
  const canCancelOrder = ['manager', 'owner', 'admin', 'chef'].includes(role);

  return {
    ok: true,
    access: {
      tokenId: data.id,
      restaurantId: data.restaurant_id,
      restaurantName: restaurant?.name ?? null,
      memberName: data.member_name,
      memberRole: role,
      canUpdateOrderStatus: true,
      canCancelOrder,
    },
  };
}

function isTeamScanFailure(result: TeamScanValidationResult): result is Extract<TeamScanValidationResult, { ok: false }> {
  return result.ok === false;
}

async function handleAuth(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req);
  const result = await validateTeamScanAccess(String(body?.token || ''), String(body?.pin || ''), {
    touchUsage: true,
  });
  if (isTeamScanFailure(result)) return res.status(result.status).json({ error: result.error });

  return res.status(200).json({
    success: true,
    member: {
      name: result.access.memberName,
      role: result.access.memberRole,
    },
    restaurant: {
      id: result.access.restaurantId,
      name: result.access.restaurantName,
    },
    capabilities: {
      canUpdateOrderStatus: result.access.canUpdateOrderStatus,
      canCancelOrder: result.access.canCancelOrder,
    },
  });
}

async function handleOrders(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req);
  const access = await validateTeamScanAccess(String(body?.token || ''), String(body?.pin || ''));
  if (isTeamScanFailure(access)) return res.status(access.status).json({ error: access.error });

  const supabase = getSupabaseAdmin();
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id,order_number,status,type,total_amount,delivery_address,notes,created_at')
    .eq('restaurant_id', access.access.restaurantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (ordersError) return res.status(500).json({ error: ordersError.message });

  const orderIds = (orders || []).map((order) => order.id);
  const itemsByOrder = new Map<string, any[]>();

  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id,order_id,item_name,quantity,unit_price,subtotal,notes')
      .in('order_id', orderIds);

    if (itemsError) return res.status(500).json({ error: itemsError.message });

    for (const item of items || []) {
      const arr = itemsByOrder.get(item.order_id) ?? [];
      arr.push(item);
      itemsByOrder.set(item.order_id, arr);
    }
  }

  return res.status(200).json({
    success: true,
    orders: (orders || []).map((order) => ({
      ...order,
      items: itemsByOrder.get(order.id) ?? [],
    })),
  });
}

async function handleUpdateOrderStatus(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req);
  const access = await validateTeamScanAccess(String(body?.token || ''), String(body?.pin || ''));
  if (isTeamScanFailure(access)) return res.status(access.status).json({ error: access.error });

  const orderId = String(body?.orderId || '');
  const newStatus = String(body?.newStatus || '').trim();
  if (!orderId) return res.status(400).json({ error: 'Commande requise' });
  if (!ALLOWED_STATUSES.has(newStatus)) return res.status(400).json({ error: 'Statut invalide' });
  if (newStatus === 'cancelled' && !access.access.canCancelOrder) {
    return res.status(403).json({ error: 'Annulation réservée au manager' });
  }

  const supabase = getSupabaseAdmin();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id,status,restaurant_id')
    .eq('id', orderId)
    .eq('restaurant_id', access.access.restaurantId)
    .maybeSingle();

  if (orderError) return res.status(500).json({ error: orderError.message });
  if (!order) return res.status(404).json({ error: 'Commande introuvable' });
  if (newStatus !== 'cancelled' && NEXT_STATUS[order.status] !== newStatus) {
    return res.status(400).json({ error: 'Transition de statut refusée' });
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('restaurant_id', access.access.restaurantId);

  if (updateError) return res.status(500).json({ error: updateError.message });
  return res.status(200).json({ success: true });
}

// ────────────────────────────────────────────────────────────────────────────
// Event ticket scanner handlers (/validator page on scan.restafy.shop).
// Kept in this same serverless function to stay under the Vercel Hobby
// 12-function limit — an additional api/tickets/validate.ts would push the
// total to 13 and break the deploy.
// ────────────────────────────────────────────────────────────────────────────

async function handleEvents(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req);
  const access = await validateTeamScanAccess(String(body?.token || ''), String(body?.pin || ''));
  if (isTeamScanFailure(access)) return res.status(access.status).json({ error: access.error });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('events')
    .select('id, title, start_time, is_published, image_url, location')
    .eq('restaurant_id', access.access.restaurantId)
    .order('start_time', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });

  // Alias DB columns to the stable shape expected by the client (EventRow).
  const events = (data || []).map((e: any) => ({
    id: e.id,
    name: e.title,
    start_at: e.start_time,
    status: e.is_published ? 'published' : 'draft',
    cover_image: e.image_url,
    location: e.location,
  }));
  return res.status(200).json({ events });
}

async function handlePreloadTickets(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req);
  const access = await validateTeamScanAccess(String(body?.token || ''), String(body?.pin || ''));
  if (isTeamScanFailure(access)) return res.status(access.status).json({ error: access.error });

  const eventId = String(body?.event_id || '').trim();
  if (!eventId) return res.status(400).json({ error: 'event_id requis' });

  const supabase = getSupabaseAdmin();

  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .select('id, title, restaurant_id, start_time')
    .eq('id', eventId)
    .maybeSingle();

  if (eventError) return res.status(500).json({ error: eventError.message });
  if (!eventRow) return res.status(404).json({ error: 'Événement introuvable' });
  if (eventRow.restaurant_id !== access.access.restaurantId) {
    return res.status(403).json({ error: 'Événement hors périmètre restaurant' });
  }

  const { data: tickets, error: ticketsError } = await supabase.rpc(
    'list_event_tickets_for_scanner',
    { p_event_id: eventId }
  );

  if (ticketsError) {
    const msg = String(ticketsError.message || '').toLowerCase();
    if (msg.includes('function') && msg.includes('does not exist')) {
      return res.status(503).json({
        error: 'Preload indisponible',
        hint: 'Appliquez la migration scripts/096-ticket-validation-rpc.sql puis rechargez le schema cache.',
      });
    }
    return res.status(500).json({ error: ticketsError.message });
  }

  return res.status(200).json({
    event: {
      id: (eventRow as any).id,
      name: (eventRow as any).title,
      start_at: (eventRow as any).start_time,
    },
    tickets: tickets || [],
    generated_at: new Date().toISOString(),
  });
}

async function handleValidateTicket(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req);
  const access = await validateTeamScanAccess(String(body?.token || ''), String(body?.pin || ''));
  if (isTeamScanFailure(access)) return res.status(access.status).json({ error: access.error });

  const rawCode = String(body?.code || '').trim();
  if (!rawCode) return res.status(400).json({ error: 'Code de billet requis' });

  const eventId = body?.event_id ? String(body.event_id) : null;
  const location = body?.location ? String(body.location).slice(0, 100) : null;

  const supabase = getSupabaseAdmin();

  // Try RPC first, fallback to direct query
  let result: any = null;
  let useRpc = true;

  try {
    const { data, error } = await supabase.rpc('validate_ticket_atomic', {
      p_lookup: rawCode,
      p_event_id: eventId,
      p_scanned_by: access.access.memberName,
      p_scan_location: location,
    });

    if (!error && data) {
      result = data;
    } else {
      useRpc = false;
    }
  } catch (rpcErr) {
    console.warn('[validate-ticket] RPC failed, using fallback:', rpcErr);
    useRpc = false;
  }

  // Fallback: direct query validation (used when the validate_ticket_atomic
  // RPC is unavailable). Contract returned here must match the RPC shape so
  // the client can rely on a single schema:
  //   { status: 'valid'|'used'|'invalid'|'expired'|'error',
  //     reason: string,
  //     ticket?: { id, ticket_number, customer_name, event_name?, ... } }
  // Schema source of truth: scripts/01-create-schema.sql (events.title,
  // events.start_time, ticket_purchases { is_used, qr_scanned_at, ... }) and
  // scripts/096-ticket-validation-rpc.sql (adds qr_scanned_by, qr_scan_location).
  if (!useRpc || !result) {
    // Two .eq() lookups instead of one .or() string. Contexte:
    // 1) Devin Review (security finding) a flagué que .or(`qr_code_data.eq.${rawCode},ticket_number.eq.${rawCode}`)
    //    interpole rawCode dans un filtre PostgREST où la virgule sépare les
    //    conditions. Un client authentifié pourrait envoyer
    //    `code: "x,id.eq.<UUID-cible>"` pour injecter une condition
    //    arbitraire et matcher des billets hors-scope (cross-tenant).
    //    Comme on tourne en service_role (RLS bypass), c'est exploitable.
    //    .eq() en revanche paramétrise la valeur côté PostgREST et empêche
    //    l'injection — pas de chaîne reconstruite.
    // 2) Avant ce PR, le scope event_id était concaténé DANS le .or() au
    //    lieu d'un AND séparé, ce qui pouvait casser .maybeSingle() en
    //    "multiple rows returned" si event_id matchait plusieurs lignes.
    //    Avec deux requêtes séparées + .eq() le scope est appliqué proprement.
    const baseSelect =
      'id, ticket_number, customer_name, status, is_used, qr_scanned_at, qr_scanned_by, event_id, events(title, start_time)';
    const qByQr = supabase.from('ticket_purchases').select(baseSelect).eq('qr_code_data', rawCode);
    const scopedQr = eventId ? qByQr.eq('event_id', eventId) : qByQr;
    let { data: ticket, error: ticketError } = await scopedQr.maybeSingle();
    if (!ticketError && !ticket) {
      const qByNumber = supabase
        .from('ticket_purchases')
        .select(baseSelect)
        .eq('ticket_number', rawCode);
      const scopedNumber = eventId ? qByNumber.eq('event_id', eventId) : qByNumber;
      const second = await scopedNumber.maybeSingle();
      ticket = second.data;
      ticketError = second.error;
    }

    if (ticketError || !ticket) {
      return res.status(200).json({ status: 'invalid', reason: 'not_found' });
    }

    if (eventId && ticket.event_id !== eventId) {
      return res.status(200).json({ status: 'invalid', reason: 'wrong_event' });
    }

    const eventsRel = (ticket as any).events as { title?: string; start_time?: string } | null;
    const eventName = eventsRel?.title ?? null;
    const eventStart = eventsRel?.start_time ?? null;

    const baseTicket = {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      customer_name: ticket.customer_name,
      event_name: eventName,
    };

    if (!['confirmed', 'paid', 'completed'].includes(String(ticket.status))) {
      return res.status(200).json({
        status: 'invalid',
        reason: 'unpaid',
        ticket: { ...baseTicket, payment_status: ticket.status },
      });
    }

    if (eventStart && new Date(eventStart).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      return res.status(200).json({
        status: 'expired',
        reason: 'event_passed',
        ticket: { ...baseTicket, event_start_at: eventStart },
      });
    }

    if (ticket.is_used || ticket.qr_scanned_at) {
      return res.status(200).json({
        status: 'used',
        reason: 'already_scanned',
        ticket: { ...baseTicket, scanned_at: ticket.qr_scanned_at, scanned_by: ticket.qr_scanned_by },
      });
    }

    // Atomic mark-used: WHERE guard blocks the race between two scanners.
    // We intentionally do NOT touch ticket_purchases.status (CHECK constraint
    // only allows pending|confirmed|cancelled). Used-state lives on is_used
    // + qr_scanned_at which are indexed and what the rest of the app reads.
    const nowIso = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('ticket_purchases')
      .update({
        is_used: true,
        qr_scanned_at: nowIso,
        qr_scanned_by: access.access.memberName,
        qr_scan_location: location,
      })
      .eq('id', ticket.id)
      .eq('is_used', false)
      .is('qr_scanned_at', null)
      .select('id, qr_scanned_at, qr_scanned_by')
      .maybeSingle();

    if (updateError) {
      return res
        .status(500)
        .json({ status: 'error', reason: 'update_failed', message: updateError.message });
    }

    if (!updated) {
      // Race lost: another scanner won between our SELECT and UPDATE.
      return res.status(200).json({
        status: 'used',
        reason: 'race_lost',
        ticket: { ...baseTicket },
      });
    }

    return res.status(200).json({
      status: 'valid',
      reason: 'ok',
      ticket: {
        ...baseTicket,
        scanned_at: updated.qr_scanned_at,
        scanned_by: updated.qr_scanned_by,
        scan_location: location,
      },
    });
  }

  return res.status(200).json(result);
}

async function handleSyncTickets(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req);
  const access = await validateTeamScanAccess(String(body?.token || ''), String(body?.pin || ''));
  if (isTeamScanFailure(access)) return res.status(access.status).json({ error: access.error });

  const eventId = body?.event_id ? String(body.event_id) : null;
  const scans = Array.isArray(body?.scans) ? body.scans : [];
  if (scans.length === 0) return res.status(200).json({ synced: 0, results: [], total: 0 });
  if (scans.length > 200) return res.status(400).json({ error: 'Lot trop grand (max 200)' });

  const supabase = getSupabaseAdmin();
  const results: Array<{ code: string; status: string; reason: string }> = [];
  let synced = 0;

  for (const item of scans) {
    const code = String(item?.code || '').trim();
    if (!code) {
      results.push({ code: '', status: 'invalid', reason: 'missing_code' });
      continue;
    }
    const location = item?.location ? String(item.location).slice(0, 100) : null;
    const { data, error } = await supabase.rpc('validate_ticket_atomic', {
      p_lookup: code,
      p_event_id: eventId,
      p_scanned_by: access.access.memberName,
      p_scan_location: location,
    });

    if (error) {
      results.push({ code, status: 'error', reason: error.message || 'rpc_error' });
      continue;
    }
    const status = String((data as any)?.status || 'invalid');
    const reason = String((data as any)?.reason || '');
    results.push({ code, status, reason });
    if (status === 'valid') synced += 1;
  }

  return res.status(200).json({ synced, results, total: scans.length });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res, req);

  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = String(req.query?.action || '').trim();

  // Lightweight diagnostic endpoint: GET /api/team-scan?action=health
  if (req.method === 'GET' && action === 'health') {
    const hasUrl = Boolean(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
    );
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    // NB: on ne renvoie pas la longueur ni le préfixe de la clé — juste des
    // booléens — pour éviter toute fuite de reconnaissance sur un endpoint
    // non authentifié.
    return res.status(200).json({
      ok: true,
      supabase: {
        url: hasUrl,
        serviceRoleKey: Boolean(key),
        serviceRoleKeyLooksValid: key.length > 100 && key.startsWith('eyJ'),
      },
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit pour bloquer le spam de scan / brute-force PIN. L'identité est
  // l'IP (le scanner staff utilise un token PIN-derived qui n'est pas un user
  // Supabase). Limite généreuse (120/min) pour ne pas gêner une équipe qui
  // scanne en rafale lors d'un événement, mais bloquer un attaquant qui
  // enchaîne 1000 PIN-guesses ou 1000 scans factices. Fail-open.
  {
    const ipIdentity = `ip:${getClientIp(req.headers)}`;
    const rl = await checkRateLimit({
      bucket: 'team_scan',
      identity: ipIdentity,
      limit: 120,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfter));
      return res.status(429).json({
        error: 'Too many scan requests',
        message: `Trop de requêtes. Réessayez dans ${rl.retryAfter}s.`,
        retry_after_seconds: rl.retryAfter,
      });
    }
  }

  try {
    if (action === 'auth') return await handleAuth(req, res);
    if (action === 'orders') return await handleOrders(req, res);
    if (action === 'update-order-status') return await handleUpdateOrderStatus(req, res);
    if (action === 'events') return await handleEvents(req, res);
    if (action === 'preload-tickets') return await handlePreloadTickets(req, res);
    if (action === 'validate-ticket') return await handleValidateTicket(req, res);
    if (action === 'sync-tickets') return await handleSyncTickets(req, res);
    return res.status(400).json({ error: 'Action invalide' });
  } catch (error) {
    if (error instanceof ServerConfigError) {
      return res.status(500).json({ error: error.message });
    }
    console.error('[team-scan] Unhandled error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Erreur serveur',
    });
  }
}

/**
 * =====================================================================
 * LITE API - Endpoint pour le widget Lite vanilla
 * =====================================================================
 * 
 * GET /api/lite?slug=restaurant-slug
 * 
 * Retourne les données minimales pour afficher le widget Lite:
 * - Restaurant (nom, logo, horaires, min_order)
 * - Catégories
 * - Items disponibles
 * 
 * @author Restafy Team
 * =====================================================================
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.APP_URL || 'https://restafy.shop';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase config');
  return createClient(url, key);
}

function applyCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigins = ['https://restafy.shop', 'https://www.restafy.shop', APP_URL];
  
  // Use exact match - no partial includes to prevent bypass
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;
  
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Paramètre slug requis' });
  }

  try {
    const supabase = getSupabase();
    
    // Restaurant
    const { data: restaurant, error: restError } = await supabase
      .from('restaurants')
      .select('id, name, slug, logo_url, description, phone, address, city, delivery_fee, min_order, is_open, rating, delivery_time, ussd_mtn, ussd_moov')
      .eq('slug', slug)
      .eq('is_open', true)
      .single();

    if (restError || !restaurant) {
      return res.status(404).json({ error: 'Restaurant indisponible ou fermé' });
    }

    // Catégories
    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order');

    // Items (seulement disponible et avec prix)
    const { data: items } = await supabase
      .from('items')
      .select('id, name, description, price, category_id, image_url, is_available')
      .eq('restaurant_id', restaurant.id)
      .eq('is_available', true)
      .gt('price', 0)
      .order('name');

    // Masquer les infos sensibles
    const safeRestaurant = {
      ...restaurant,
      ussd_mtn: undefined,
      ussd_moov: undefined,
    };

    return res.status(200).json({
      restaurant: safeRestaurant,
      categories: categories || [],
      items: items || [],
    });
  } catch (err) {
    console.error('[lite API]', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Handshake, Loader2, Mail, Phone, MapPin, Building2, Calendar, RefreshCw } from 'lucide-react';

type Status = 'pending' | 'contacted' | 'archived';

interface Row {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  restaurant_name: string;
  city: string | null;
  message: string | null;
  status: Status;
  source_host: string | null;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: 'À traiter',
  contacted: 'Contacté',
  archived: 'Archivé',
};

export default function PartnerJoinRequests() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    const { data, error: qErr } = await supabase
      .from('partner_join_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (qErr) {
      if (qErr.code === 'PGRST205' || qErr.message?.includes('does not exist') || qErr.message?.includes('schema cache')) {
        setError(
          'Table introuvable. Exécutez le script scripts/083-partner-join-requests.sql dans l’éditeur SQL Supabase, puis rechargez le schéma API si besoin.',
        );
      } else if (qErr.code === '42501' || qErr.message?.includes('policy')) {
        setError('Accès refusé (RLS). Vérifiez que votre compte est super_admin.');
      } else {
        setError(qErr.message);
      }
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, status: Status) => {
    setUpdatingId(id);
    setError(null);
    const { error: uErr } = await supabase.from('partner_join_requests').update({ status }).eq('id', id);
    setUpdatingId(null);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto text-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight flex items-center gap-3">
            <Handshake className="w-8 h-8 text-orange-500" />
            Demandes partenaires
          </h1>
          <p className="text-zinc-400 text-sm mt-2">
            Inscriptions depuis la vitrine (www). Traitez les demandes puis passez le statut à « Contacté » ou « Archivé ».
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center text-zinc-500">
          Aucune demande pour le moment. Les soumissions depuis la landing apparaîtront ici.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-lg shadow-black/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="font-black text-lg text-white">{r.restaurant_name}</p>
                  <p className="text-sm text-zinc-400 flex items-center gap-2 mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(r.created_at).toLocaleString('fr-FR')}
                    {r.source_host && (
                      <span className="text-zinc-600">· depuis {r.source_host}</span>
                    )}
                  </p>
                </div>
                <span
                  className={`text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full ${
                    r.status === 'pending'
                      ? 'bg-amber-500/20 text-amber-300'
                      : r.status === 'contacted'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-zinc-600/40 text-zinc-300'
                  }`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm text-zinc-300 mb-4">
                <p className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="text-zinc-500">Contact :</span> {r.full_name}
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                  <a href={`mailto:${r.email}`} className="text-orange-400 hover:underline font-semibold">
                    {r.email}
                  </a>
                </p>
                {r.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
                    <a href={`tel:${r.phone}`} className="hover:text-white">
                      {r.phone}
                    </a>
                  </p>
                )}
                {r.city && (
                  <p className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-zinc-500 shrink-0" />
                    {r.city}
                  </p>
                )}
              </div>

              {r.message && (
                <p className="text-sm text-zinc-400 border-t border-white/5 pt-4 mb-4 whitespace-pre-wrap">
                  {r.message}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                {r.status !== 'contacted' && (
                  <button
                    type="button"
                    disabled={updatingId === r.id}
                    onClick={() => void setStatus(r.id, 'contacted')}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    Marquer contacté
                  </button>
                )}
                {r.status !== 'archived' && (
                  <button
                    type="button"
                    disabled={updatingId === r.id}
                    onClick={() => void setStatus(r.id, 'archived')}
                    className="rounded-xl bg-zinc-700 hover:bg-zinc-600 px-4 py-2 text-xs font-bold disabled:opacity-50"
                  >
                    Archiver
                  </button>
                )}
                {r.status !== 'pending' && (
                  <button
                    type="button"
                    disabled={updatingId === r.id}
                    onClick={() => void setStatus(r.id, 'pending')}
                    className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold hover:bg-white/5 disabled:opacity-50"
                  >
                    Remettre à traiter
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

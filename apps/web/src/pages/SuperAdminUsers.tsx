import React, { useState, useEffect } from 'react';
import { Search, Shield, Star, ShoppingBag, Ban, ArrowLeft, Trash2, AlertTriangle, X, Loader2, MoreVertical, Eye, Mail, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { sendUserStatusEmail } from '@/lib/email';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  loyalty_points: number;
  is_banned: boolean;
  is_active: boolean;
  total_orders: number;
  created_at: string;
  restaurant_id: string | null;
}

interface DeleteConfirmationModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

function DeleteConfirmationModal({ user, isOpen, onClose, onConfirm, isDeleting }: DeleteConfirmationModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const expectedText = 'SUPPRIMER';
  const canConfirm = confirmText === expectedText;

  // Reset le texte quand la modal s'ouvre
  useEffect(() => {
    if (isOpen) setConfirmText('');
  }, [isOpen]);

  if (!isOpen || !user) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#1A1A1A] border border-red-500/20 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="bg-red-500/10 border-b border-red-500/20 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Supprimer l'utilisateur</h3>
                <p className="text-sm text-red-400">Cette action est irreversible</p>
              </div>
              <button
                onClick={onClose}
                className="ml-auto p-2 hover:bg-white/5 rounded-lg transition"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* User info */}
            <div className="bg-zinc-800/50 rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-700 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {user.full_name?.[0] || '?'}
              </div>
              <div>
                <p className="font-bold text-white">{user.full_name || 'Sans nom'}</p>
                <p className="text-sm text-zinc-400">{user.email}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {user.total_orders || 0} commandes - {(user.loyalty_points || 0).toLocaleString()} points
                </p>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-sm text-yellow-400 font-semibold mb-2">Consequences de la suppression :</p>
              <ul className="text-xs text-yellow-400/80 space-y-1">
                <li>- Compte utilisateur supprime definitivement</li>
                <li>- Historique de commandes conserve (anonymise)</li>
                <li>- Points de fidelite perdus</li>
                <li>- L'utilisateur ne pourra plus se connecter</li>
              </ul>
            </div>

            {/* Confirmation input */}
            <div>
              <label className="block text-sm font-semibold text-zinc-300 mb-2">
                Tapez <span className="text-red-400 font-mono bg-red-500/10 px-2 py-0.5 rounded">SUPPRIMER</span> pour confirmer
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="SUPPRIMER"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50 font-mono"
                disabled={isDeleting}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-white/5 p-4 flex gap-3">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm || isDeleting}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Suppression...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Supprimer definitivement
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface UserActionsMenuProps {
  user: User;
  onBan: () => void;
  onDelete: () => void;
  onView: () => void;
  isLoading: boolean;
}

function UserActionsMenu({ user, onBan, onDelete, onView, isLoading }: UserActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-white/5 rounded-lg transition"
      >
        <MoreVertical className="w-4 h-4 text-zinc-400" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute right-0 top-full mt-1 z-50 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl py-2 min-w-[180px]"
            >
              <button
                onClick={() => { onView(); setIsOpen(false); }}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition text-zinc-300"
              >
                <Eye className="w-4 h-4" />
                Voir le profil
              </button>

              <button
                onClick={() => { onBan(); setIsOpen(false); }}
                disabled={isLoading}
                className={cn(
                  "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-white/5 transition disabled:opacity-50",
                  user.is_banned ? "text-emerald-400" : "text-amber-400"
                )}
              >
                <Ban className="w-4 h-4" />
                {user.is_banned ? 'Debannir' : 'Bannir'}
              </button>

              <div className="border-t border-white/5 my-2" />

              <button
                onClick={() => { onDelete(); setIsOpen(false); }}
                disabled={isLoading || user.role === 'super_admin'}
                className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-red-500/10 transition text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer le compte
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const roleConfig: Record<string, { label: string; color: string }> = {
  client: { label: 'Client', color: 'text-blue-400' },
  livreur: { label: 'Livreur', color: 'text-purple-400' },
  restaurant_owner: { label: 'Restaurant', color: 'text-primary' },
  restaurant: { label: 'Restaurant', color: 'text-primary' },
  super_admin: { label: 'Admin', color: 'text-red-400' },
};

export default function SuperAdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers((data as User[]) || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string, isBanned: boolean) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ is_banned: !isBanned })
        .eq('id', userId);

      if (error) throw error;
      const updatedUser = users.find(u => u.id === userId);
      setUsers(users.map(u =>
        u.id === userId ? { ...u, is_banned: !isBanned } : u
      ));

      // ✅ Envoyer un email à l'utilisateur
      if (updatedUser?.email) {
        sendUserStatusEmail({
          userName: updatedUser.full_name || updatedUser.email.split('@')[0],
          userEmail: updatedUser.email,
          isBanned: !isBanned,
        }).then(result => {
          if (!result.success) console.warn('[Email] Notification non envoyée:', result.error);
          else console.log('[Email] Notification envoyée à:', updatedUser.email);
        });
      }
    } catch (error) {
      alert('Erreur lors de la mise a jour');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    // Protection: ne pas permettre la suppression d'un super_admin
    if (userToDelete.role === 'super_admin') {
      alert('Impossible de supprimer un compte super admin');
      return;
    }

    try {
      setIsDeleting(true);

      // 1. Supprimer le profil (les commandes seront anonymisees grace a ON DELETE SET NULL)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userToDelete.id);

      if (profileError) {
        throw new Error('Erreur lors de la suppression du profil');
      }

      // 2. Mettre a jour l'interface
      setUsers(users.filter(u => u.id !== userToDelete.id));
      setDeleteModalOpen(false);
      setUserToDelete(null);

    } catch (error) {
      alert('Impossible de supprimer l\'utilisateur. Veuillez réessayer.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteModal = (user: User) => {
    if (user.role === 'super_admin') {
      alert('Impossible de supprimer un compte super admin');
      return;
    }
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const filtered = users.filter(u => {
    const matchesSearch =
      (u.full_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (u.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (u.phone || '').includes(search);

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/superadmin/dashboard')} className="p-2 hover:bg-white/5 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold">Utilisateurs</h2>
        </div>
        <div className="text-center py-12 text-zinc-500">Chargement...</div>
      </div>
    );
  }

  const activeUsers = users.filter(u => !u.is_banned).length;
  const bannedUsers = users.filter(u => u.is_banned).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/superadmin/dashboard')} className="p-2 hover:bg-white/5 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold">Utilisateurs</h2>
          <p className="text-zinc-500 text-sm">{users.length} total · {activeUsers} actifs</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: 'Total', v: users.length, c: 'text-white' },
          { l: 'Actifs', v: activeUsers, c: 'text-emerald-400' },
          { l: 'Bannís', v: bannedUsers, c: 'text-red-400' },
          { l: 'Clients', v: users.filter(u => u.role === 'client').length, c: 'text-blue-400' },
        ].map(s => (
          <div key={s.l} className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
            <p className="text-xs text-zinc-500">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email ou telephone..."
            className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm outline-none focus:border-primary/50 text-white placeholder:text-zinc-600"
          />
        </div>

        {/* Role Filter */}
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'all', label: 'Tous' },
            { value: 'client', label: 'Clients' },
            { value: 'restaurant_owner', label: 'Restaurants' },
            { value: 'livreur', label: 'Livreurs' },
            { value: 'super_admin', label: 'Admins' },
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setRoleFilter(filter.value)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap',
                roleFilter === filter.value
                  ? 'bg-primary text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {['Utilisateur', 'Rôle', 'Commandes', 'Points', 'Statut', 'Actions'].map(h => (
                <th key={h} className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.length > 0 ? filtered.map(u => (
              <tr key={u.id} className={cn('hover:bg-white/[0.02] transition-colors', u.is_banned && 'bg-red-500/5')}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-zinc-700 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">{u.full_name[0]}</div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{u.full_name || 'N/A'}</p>
                      <p className="text-[10px] text-zinc-500 truncate">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={cn('text-xs font-bold whitespace-nowrap', roleConfig[u.role]?.color || 'text-zinc-400')}>
                    {roleConfig[u.role]?.label || u.role}
                  </span>
                </td>
                <td className="px-4 py-4 font-bold">{u.total_orders || 0}</td>
                <td className="px-4 py-4">
                  {u.loyalty_points > 0 ? (
                    <span className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                      <Star className="w-3 h-3" /> {(u.loyalty_points || 0).toLocaleString()}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-4">
                  <span className={cn('text-[10px] font-bold uppercase px-2 py-1 rounded-lg border whitespace-nowrap',
                    !u.is_banned ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border-red-500/20'
                  )}>
                    {!u.is_banned ? '● Actif' : '⚠ Banni'}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <UserActionsMenu
                    user={u}
                    onBan={() => handleBanUser(u.id, u.is_banned)}
                    onDelete={() => openDeleteModal(u)}
                    onView={() => {/* TODO: modal detail */ }}
                    isLoading={actionLoading}
                  />
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  Aucun utilisateur trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        user={userToDelete}
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteUser}
        isDeleting={isDeleting}
      />
    </div>
  );
}

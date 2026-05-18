import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertTriangle, Trash2, MoreVertical, Eye, Ban, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UserManagementGuide() {
  const navigate = useNavigate();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const steps = [
    {
      title: "Accéder au Panneau Utilisateurs",
      icon: ShieldAlert,
      color: "blue",
      description: "Cliquez sur l'onglet 'Utilisateurs' depuis le menu SuperAdmin",
      details: [
        "Vous verrez une liste de tous les utilisateurs de la plateforme",
        "Chaque utilisateur affiche: nom, email, téléphone, rôle, commandes, points fidélité",
        "Les utilisateurs bannnis ont un badge distinctif"
      ]
    },
    {
      title: "Rechercher l'Utilisateur",
      icon: Eye,
      color: "purple",
      description: "Utilisez la barre de recherche et les filtres pour trouver l'utilisateur",
      details: [
        "Recherche par: nom, email, ou numéro de téléphone",
        "Filtrer par rôle: Tous, Clients, Restaurants, Livreurs, Admins",
        "Les résultats se mettent à jour en temps réel"
      ]
    },
    {
      title: "Ouvrir le Menu d'Actions",
      icon: MoreVertical,
      color: "green",
      description: "Cliquez sur l'icône ⋮ (trois points) à droite de la ligne",
      details: [
        "Un menu contextuel s'affiche avec 3 options",
        "Voir le profil: accéder aux détails complets de l'utilisateur",
        "Bannir/Débannir: bloquer ou débloquer l'accès",
        "Supprimer le compte: supprimer définitivement l'utilisateur"
      ]
    },
    {
      title: "Cliquer sur 'Supprimer le compte'",
      icon: Trash2,
      color: "red",
      description: "Sélectionnez l'option 'Supprimer le compte'",
      details: [
        "Cette option n'est visible que pour les comptes non-super_admin",
        "Les super admins ne peuvent pas être supprimés",
        "Une confirmation est requise dans les étapes suivantes"
      ]
    },
    {
      title: "Confirmer l'Utilisateur à Supprimer",
      icon: AlertTriangle,
      color: "orange",
      description: "Vérifier les informations de l'utilisateur affiché",
      details: [
        "La modal affiche le nom complet et l'email",
        "Vérifier que c'est bien l'utilisateur à supprimer",
        "Lire les conséquences de la suppression"
      ]
    },
    {
      title: "Taper 'SUPPRIMER' pour Confirmer",
      icon: CheckCircle2,
      color: "emerald",
      description: "Tapez exactement le mot SUPPRIMER dans le champ de texte",
      details: [
        "Le champ demande: 'Tapez SUPPRIMER pour confirmer'",
        "Le texte doit correspondre exactement (majuscules/minuscules)",
        "Le bouton 'Supprimer définitivement' s'active seulement après"
      ]
    },
    {
      title: "Cliquer sur 'Supprimer définitivement'",
      icon: Trash2,
      color: "red",
      description: "Cliquez sur le bouton rouge pour finaliser la suppression",
      details: [
        "Une animation de chargement s'affiche pendant le traitement",
        "La suppression est effectuée immédiatement",
        "La modal se ferme et l'utilisateur disparaît de la liste"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white">Guide Gestion Utilisateurs</h1>
              <p className="text-sm text-zinc-400 mt-1">Comment supprimer des utilisateurs en toute sécurité</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Overview Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="font-bold text-white mb-2">Permissions Requises</h3>
            <p className="text-sm text-zinc-400">Seuls les Super Admins peuvent supprimer des utilisateurs</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6">
            <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="font-bold text-white mb-2">Action Irréversible</h3>
            <p className="text-sm text-zinc-400">La suppression est définitive et ne peut pas être annulée</p>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="font-bold text-white mb-2">Sécurité Maximale</h3>
            <p className="text-sm text-zinc-400">Confirmation textuelle + protections multiples intégrées</p>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Étapes de Suppression</h2>
          
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isExpanded = expandedStep === index;
            const colorClasses = {
              blue: "bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/15",
              purple: "bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/15",
              green: "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15",
              red: "bg-red-500/10 border-red-500/20 hover:bg-red-500/15",
              orange: "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/15",
            };

            return (
              <div
                key={index}
                onClick={() => setExpandedStep(isExpanded ? null : index)}
                className={`border rounded-2xl p-6 cursor-pointer transition ${colorClasses[step.color as keyof typeof colorClasses]}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-white/10`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">
                        Étape {index + 1}: {step.title}
                      </h3>
                      <span className="text-sm font-semibold text-zinc-400 bg-white/5 px-3 py-1 rounded-lg">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                    
                    <p className="text-zinc-400 text-sm mb-4">{step.description}</p>

                    {isExpanded && (
                      <div className="pt-4 border-t border-white/10 mt-4 space-y-2">
                        {step.details.map((detail, detailIndex) => (
                          <div key={detailIndex} className="flex gap-3 text-sm text-zinc-300">
                            <span className="text-white/50 mt-0.5">•</span>
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Security Features */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 border border-white/10 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Protections Intégrées</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Côté Client
              </h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>✓ Champ de confirmation textuel obligatoire</li>
                <li>✓ Affichage des conséquences de la suppression</li>
                <li>✓ Informations de l'utilisateur pour vérification</li>
                <li>✓ Désactivation du bouton jusqu'à confirmation</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Côté Serveur
              </h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>✓ Row Level Security (RLS) policies</li>
                <li>✓ Protection contre les super admins</li>
                <li>✓ Transactions atomiques SQL</li>
                <li>✓ Audit logs de toutes les actions</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Warnings */}
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            Points Importants
          </h2>
          
          <ul className="space-y-3 text-sm text-red-300">
            <li className="flex gap-3">
              <span className="text-red-400 font-bold">!</span>
              <span>La suppression est <strong>irréversible</strong> - l'utilisateur et ses données ne peuvent pas être récupérés</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-400 font-bold">!</span>
              <span>Les commandes de l'utilisateur sont <strong>conservées mais anonymisées</strong> pour l'audit</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-400 font-bold">!</span>
              <span>Toutes les suppressions sont <strong>enregistrées dans les logs d'audit</strong></span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-400 font-bold">!</span>
              <span>Les super admins <strong>ne peuvent pas se supprimer eux-mêmes</strong></span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { AlertCircle, Package, Ticket, Users, MessageCircle } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-restaurants' | 'no-orders' | 'no-events' | 'no-results' | 'no-users' | 'error' | 'loading';
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  title,
  description,
  action,
  className = '',
}) => {
  const configs = {
    'no-restaurants': {
      icon: null,
      image: '/illustrations/no-restaurants.jpg',
      defaultTitle: 'Aucun restaurant trouvé',
      defaultDesc: 'Essayez de modifier vos critères de recherche',
    },
    'no-orders': {
      icon: Package,
      image: null,
      defaultTitle: 'Aucune commande',
      defaultDesc: 'Commencez à commander dès maintenant',
    },
    'no-events': {
      icon: Ticket,
      image: null,
      defaultTitle: 'Aucun événement',
      defaultDesc: 'Revenez bientôt pour découvrir les prochains événements',
    },
    'no-results': {
      icon: null,
      image: '/illustrations/no-restaurants.jpg',
      defaultTitle: 'Aucun résultat',
      defaultDesc: 'Nous n\'avons rien trouvé pour votre recherche',
    },
    'no-users': {
      icon: Users,
      image: null,
      defaultTitle: 'Aucun utilisateur',
      defaultDesc: 'Il n\'y a pas d\'utilisateurs pour le moment',
    },
    'error': {
      icon: AlertCircle,
      image: null,
      defaultTitle: 'Une erreur s\'est produite',
      defaultDesc: 'Veuillez rafraîchir la page et réessayer',
    },
    'loading': {
      icon: null,
      image: '/illustrations/loading-restaurants.jpg',
      defaultTitle: 'Chargement en cours',
      defaultDesc: 'Veuillez patienter...',
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div className={`text-center py-16 px-4 ${className}`}>
      {config.image ? (
        <img
          src={config.image}
          alt={title || config.defaultTitle}
          className={`w-28 h-28 mx-auto mb-6 object-contain ${
            type === 'loading' ? 'animate-pulse' : ''
          }`}
        />
      ) : Icon ? (
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Icon className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      ) : null}

      <h3 className="text-lg font-bold text-gray-900 mb-2">
        {title || config.defaultTitle}
      </h3>

      {description !== undefined && (
        <p className="text-sm text-gray-500 mb-6">
          {description || config.defaultDesc}
        </p>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold text-sm hover:bg-orange-600 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

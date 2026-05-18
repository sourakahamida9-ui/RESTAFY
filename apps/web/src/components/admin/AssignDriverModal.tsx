import React, { useState } from 'react';
import { X, Loader2, MessageCircle, Phone } from 'lucide-react';
import { useDeliveryDrivers, DeliveryDriver } from '@/hooks/useDeliveryDrivers';
import { toast } from 'sonner';

interface AssignDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    restaurant_id: string;
    customer_name: string;
    customer_address: string;
    total_amount: number;
    created_at: string;
    restaurant_name?: string;
  } | null;
}

export function AssignDriverModal({ isOpen, onClose, order }: AssignDriverModalProps) {
  const [selectedDriver, setSelectedDriver] = useState<DeliveryDriver | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const { availableDrivers, assignDriver } = useDeliveryDrivers(order?.restaurant_id || null);

  if (!isOpen || !order) return null;

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const maskPhone = (phone: string) => {
    // +22961234567 → +229****4567
    return phone.slice(0, 5) + '****' + phone.slice(-4);
  };

  const generateWhatsAppMessage = (driver: DeliveryDriver) => {
    const orderId = order.id.slice(0, 8).toUpperCase();
    const time = formatTime(order.created_at);

    return encodeURIComponent(
      `Bonjour ${driver.name} 👋\n\nNouvelle livraison à effectuer !\n\n🏪 Restaurant : ${order.restaurant_name || 'Restaurant'}\n📦 Commande #${orderId}\n📍 Adresse client : ${order.customer_address}\n💰 Montant : ${order.total_amount.toLocaleString('fr-FR')} FCFA\n🕐 Heure de commande : ${time}\n\nMerci de confirmer votre prise en charge. 🛵`
    );
  };

  const handleAssignAndNotify = async () => {
    if (!selectedDriver) {
      toast.error('Sélectionnez un livreur');
      return;
    }

    setIsAssigning(true);

    try {
      // Assigner le livreur dans la base de données
      const result = await assignDriver(order.id, selectedDriver.id);

      if (result && typeof result === 'object' && 'driver' in result) {
        // Générer le message WhatsApp
        const message = generateWhatsAppMessage(selectedDriver);
        const whatsappUrl = `https://wa.me/${selectedDriver.phone}?text=${message}`;

        // Ouvrir WhatsApp dans un nouvel onglet
        window.open(whatsappUrl, '_blank');

        // Fermer le modal après succès
        setTimeout(() => {
          onClose();
          setSelectedDriver(null);
        }, 500);
      }
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-zinc-100 p-6 flex items-center justify-between">
          <div>
            <h2 className="font-black text-zinc-900">Assigner un livreur</h2>
            <p className="text-sm text-zinc-500 mt-1">Commande #{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-6">
          {/* Résumé commande */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600">Client</span>
                <span className="font-semibold text-zinc-900">{order.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Adresse</span>
                <span className="font-semibold text-zinc-900 text-right">{order.customer_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Montant</span>
                <span className="font-bold text-emerald-600">{order.total_amount.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
          </div>

          {/* Sélection livreur */}
          <div>
            <h3 className="font-bold text-zinc-900 mb-3">Livreurs disponibles</h3>

            {availableDrivers.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <p className="text-sm text-amber-900">Aucun livreur disponible</p>
                <p className="text-xs text-amber-700 mt-1">Ajoutez des livreurs dans la section Équipe</p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableDrivers.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => setSelectedDriver(driver)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition ${
                      selectedDriver?.id === driver.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-zinc-900">{driver.name}</p>
                      <p className="text-xs text-zinc-500">{maskPhone(driver.phone)}</p>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 flex-shrink-0" style={{
                      borderColor: selectedDriver?.id === driver.id ? '#FF6B00' : '#e4e4e7',
                      backgroundColor: selectedDriver?.id === driver.id ? '#FF6B00' : 'transparent'
                    }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aperçu du message WhatsApp */}
          {selectedDriver && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <MessageCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-green-900 space-y-1">
                  <p className="font-semibold">Aperçu message WhatsApp :</p>
                  <p className="whitespace-pre-wrap">
                    {`Bonjour ${selectedDriver.name} 👋\n\nNouvelle livraison à effectuer !\n\n🏪 Restaurant : ${order.restaurant_name || 'Restaurant'}\n📦 Commande #${order.id.slice(0, 8).toUpperCase()}\n📍 Adresse : ${order.customer_address}\n💰 Montant : ${order.total_amount.toLocaleString('fr-FR')} FCFA\n🕐 Heure : ${formatTime(order.created_at)}\n\nMerci de confirmer. 🛵`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Boutons */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-zinc-300 rounded-lg font-semibold text-zinc-700 hover:bg-zinc-50 transition"
            >
              Annuler
            </button>
            <button
              onClick={handleAssignAndNotify}
              disabled={!selectedDriver || isAssigning || availableDrivers.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Assignation...
                </>
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  Assigner & Notifier
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

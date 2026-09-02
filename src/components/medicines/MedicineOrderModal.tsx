import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  MessageCircle,
  ShoppingBag,
  ExternalLink,
  Plus,
  Check,
  Building2,
  Pill,
  FileText,
} from 'lucide-react';
import {
  generateWhatsAppOrderUrl,
  getPreferredPharmacy,
  savePreferredPharmacy,
  type PharmacyContact,
} from '../../lib/pharmacy/whatsapp';
import { writeInventory, readInventory } from '../../lib/inventory';
import { recordMedicinePurchaseExpense } from '../../lib/finance';
import type { Tables } from '../../lib/supabase/types';

type Medicine = Tables<'medicines'>;

export interface MedicineOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicine: Medicine | null;
  profileId: string;
  onStockUpdated?: (newCount: number) => void;
}

export function MedicineOrderModal({
  isOpen,
  onClose,
  medicine,
  profileId,
  onStockUpdated,
}: MedicineOrderModalProps) {
  const navigate = useNavigate();

  const [pharmacy, setPharmacy] = useState<PharmacyContact>(() => getPreferredPharmacy(profileId));
  const [isEditingPharmacy, setIsEditingPharmacy] = useState(false);
  const [packQuantity, setPackQuantity] = useState<number>(30);
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [patientArea] = useState<string>('Gulberg, Lahore');
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'instore'>('whatsapp');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (profileId) {
      setPharmacy(getPreferredPharmacy(profileId));
    }
  }, [profileId]);

  if (!medicine) return null;

  const currentInventory = readInventory(profileId);
  const stockCount = currentInventory[medicine.id] ?? 0;
  const isOutOfStock = stockCount <= 0;
  const isLowStock = stockCount > 0 && stockCount <= 5;

  const handleSavePharmacy = () => {
    savePreferredPharmacy(profileId, pharmacy);
    setIsEditingPharmacy(false);
  };

  const handleLaunchWhatsApp = () => {
    if (!pharmacy.phone.trim()) {
      setIsEditingPharmacy(true);
      return;
    }

    const url = generateWhatsAppOrderUrl({
      medicineName: medicine.medicine_name,
      strength: medicine.strength,
      doseAmount: medicine.dose_amount,
      quantityNeeded: `${packQuantity} tablets / 1 box`,
      pharmacyPhone: pharmacy.phone,
      pharmacyName: pharmacy.name,
      patientArea: patientArea,
      instructions: medicine.instructions,
    });

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRecordInStorePurchase = () => {
    if (packQuantity <= 0) return;

    const newStock = stockCount + packQuantity;
    currentInventory[medicine.id] = newStock;
    writeInventory(profileId, currentInventory);

    const priceNum = parseFloat(purchasePrice);
    if (!isNaN(priceNum) && priceNum > 0) {
      recordMedicinePurchaseExpense({
        profileId,
        medicineName: medicine.medicine_name,
        amount: priceNum,
        currency: medicine.currency || 'PKR',
        quantity: packQuantity,
        note: `In-store purchase for ${medicine.medicine_name}`,
      });
    }

    onStockUpdated?.(newStock);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1200);
  };

  const handleGoToDetails = () => {
    onClose();
    navigate(`/medicines/${medicine.id}`);
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={medicine.medicine_name}
      description={medicine.strength ? `Strength: ${medicine.strength}` : 'Doctor Prescribed Medication'}
    >
      <div className="space-y-5 pt-1 text-content">
        {/* Prescription Summary Box */}
        <div className="rounded-2xl border border-line bg-surface-sunken p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-bold text-xs border border-accent/20">
                <Pill size={16} />
              </span>
              <div>
                <h4 className="font-bold text-sm text-content leading-tight">
                  {medicine.medicine_name} {medicine.strength}
                </h4>
                <p className="text-xs text-content-muted">
                  {medicine.frequency_raw || medicine.frequency_code || 'As prescribed by doctor'}
                </p>
              </div>
            </div>

            {/* Live Cabinet Stock Badge */}
            {isOutOfStock ? (
              <Badge tone="risk" size="sm" withIcon>
                Pending Purchase (0 in stock)
              </Badge>
            ) : isLowStock ? (
              <Badge tone="warn" size="sm" withIcon>
                Low Stock: {stockCount} left
              </Badge>
            ) : (
              <Badge tone="ok" size="sm" withIcon>
                {stockCount} in cabinet
              </Badge>
            )}
          </div>

          {medicine.instructions && (
            <div className="text-xs text-content-subtle flex items-start gap-1.5 pt-1 border-t border-line/60">
              <FileText size={13} className="text-accent shrink-0 mt-0.5" />
              <span>{medicine.instructions}</span>
            </div>
          )}
        </div>

        {/* Action Choice Tabs: WhatsApp Pharmacy vs In-Store Log */}
        <div className="flex rounded-xl bg-surface-sunken p-1 border border-line">
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-content-muted hover:text-content'
            }`}
          >
            <MessageCircle size={15} />
            WhatsApp Pharmacy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('instore')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'instore'
                ? 'bg-accent text-white shadow-xs'
                : 'text-content-muted hover:text-content'
            }`}
          >
            <ShoppingBag size={15} />
            Log Store Purchase
          </button>
        </div>

        {/* Tab 1: WhatsApp Direct Inquire & Order */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-emerald-950 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} />
                  Chemist WhatsApp Contact
                </h5>
                {!isEditingPharmacy ? (
                  <p className="text-sm font-semibold text-content flex items-center gap-2">
                    <span>{pharmacy.name || 'Local Chemist'}</span>
                    <span className="text-xs text-content-muted font-mono">
                      {pharmacy.phone || '(No phone set)'}
                    </span>
                  </p>
                ) : (
                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      placeholder="Pharmacy Name (e.g., Servaid / D.Watson)"
                      value={pharmacy.name}
                      onChange={(e) => setPharmacy({ ...pharmacy, name: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-line bg-surface text-content"
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp Number (e.g. 923001234567)"
                      value={pharmacy.phone}
                      onChange={(e) => setPharmacy({ ...pharmacy, phone: e.target.value })}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-line bg-surface text-content"
                    />
                    <Button size="sm" variant="primary" onClick={handleSavePharmacy} className="h-7 text-xs">
                      Save Chemist Contact
                    </Button>
                  </div>
                )}
              </div>

              {!isEditingPharmacy && (
                <button
                  type="button"
                  onClick={() => setIsEditingPharmacy(true)}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-semibold"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="space-y-2 pt-1 border-t border-emerald-500/15">
              <div className="text-xs font-bold text-content flex items-center justify-between">
                <span>Quantity to order / ask price for:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold">{packQuantity} tablets</span>
              </div>
              <div className="flex gap-2">
                {[10, 20, 30, 60].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setPackQuantity(count)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      packQuantity === count
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-surface text-content-muted border-line hover:border-emerald-500/40'
                    }`}
                  >
                    {count} tabs
                  </button>
                ))}
              </div>
            </div>

            {/* Launch WhatsApp Order Button */}
            <Button
              variant="primary"
              onClick={handleLaunchWhatsApp}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 border-emerald-600 text-white font-bold rounded-xl shadow-xs text-sm flex items-center justify-center gap-2 tap-spring"
            >
              <MessageCircle size={18} />
              Open WhatsApp Order Chat
            </Button>
            <p className="text-[11px] text-content-subtle text-center">
              Opens WhatsApp with pre-filled prescription specs. You can attach your prescription photo in chat.
            </p>
          </div>
        )}

        {/* Tab 2: Log In-Store Purchase */}
        {activeTab === 'instore' && (
          <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
            <h5 className="text-xs font-bold text-content uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag size={13} className="text-accent" />
              Record In-Store Medicine Purchase
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="pack-qty-input" className="text-xs font-semibold text-content">
                  Tablets / Pack Size Bought
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="pack-qty-input"
                    type="number"
                    min="1"
                    value={packQuantity}
                    onChange={(e) => setPackQuantity(parseInt(e.target.value) || 0)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-line bg-surface text-content font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="purchase-price-input" className="text-xs font-semibold text-content">
                  Total Cost Paid ({medicine.currency || 'PKR'})
                </label>
                <input
                  id="purchase-price-input"
                  type="number"
                  placeholder="e.g. 1450"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-line bg-surface text-content font-bold"
                />
              </div>
            </div>

            <Button
              variant="primary"
              onClick={handleRecordInStorePurchase}
              disabled={packQuantity <= 0 || isSuccess}
              className="w-full h-11 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl shadow-xs text-sm flex items-center justify-center gap-2 tap-spring"
            >
              {isSuccess ? (
                <>
                  <Check size={18} />
                  Stock & Expense Recorded!
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Add {packQuantity} Pills to Cabinet
                </>
              )}
            </Button>
            <p className="text-[11px] text-content-subtle text-center">
              Automatically updates your cabinet inventory and logs the expense in your Finance tracker.
            </p>
          </div>
        )}

        {/* Footer Navigation: Open Full Clinical Detail */}
        <div className="pt-2 border-t border-line flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleGoToDetails}
            className="text-xs text-accent hover:text-accent-hover font-semibold flex items-center gap-1.5"
          >
            <span>View Complete Clinical Details & Explainer</span>
            <ExternalLink size={13} />
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

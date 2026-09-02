/**
 * WhatsApp Pharmacy Integration & Medicine Ordering Utility
 *
 * Facilitates direct ordering and price/delivery inquiries from local pharmacies
 * via pre-filled WhatsApp deep links.
 */

export interface PharmacyContact {
  name: string;
  phone: string; // international format e.g. "923001234567"
  area?: string;
  notes?: string;
}

export interface MedicationOrderRequest {
  medicineName: string;
  strength?: string | null;
  doseAmount?: string | null;
  quantityNeeded: string; // e.g., "1 box (30 tablets)"
  pharmacyPhone: string;
  pharmacyName?: string;
  patientArea?: string;
  instructions?: string | null;
}

const PHARMACY_STORAGE_KEY = 'medfolio_preferred_pharmacy_v1';

export function getPreferredPharmacy(profileId: string = 'default'): PharmacyContact {
  try {
    const raw = localStorage.getItem(`${PHARMACY_STORAGE_KEY}_${profileId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {
    name: 'Local Pharmacy',
    phone: '',
    area: 'Local Chemist',
  };
}

export function savePreferredPharmacy(profileId: string, pharmacy: PharmacyContact): void {
  try {
    localStorage.setItem(`${PHARMACY_STORAGE_KEY}_${profileId}`, JSON.stringify(pharmacy));
  } catch {
    // quota ignore
  }
}

/**
 * Generates a structured, professional WhatsApp inquiry message and deep-link URL.
 */
export function generateWhatsAppOrderUrl({
  medicineName,
  strength,
  doseAmount,
  quantityNeeded,
  pharmacyPhone,
  pharmacyName,
  patientArea,
  instructions,
}: MedicationOrderRequest): string {
  // Strip non-digits from phone number
  const cleanPhone = pharmacyPhone.replace(/[^\d+]/g, '').replace(/^\+/, '');

  const medicineLabel = [medicineName, strength].filter(Boolean).join(' ');

  const lines = [
    `*Hello${pharmacyName ? ' ' + pharmacyName : ''}, I would like to order medicine via Medfolio:*`,
    ``,
    `💊 *Medicine:* ${medicineLabel}`,
    doseAmount ? `📋 *Dosage:* ${doseAmount}` : '',
    instructions ? `📝 *Prescription Note:* ${instructions}` : '',
    `📦 *Requested Quantity:* ${quantityNeeded}`,
    patientArea ? `📍 *Delivery Area:* ${patientArea}` : '',
    ``,
    `*Could you please confirm:*`,
    `1. Availability & Price per pack`,
    `2. Home delivery time and charges`,
    ``,
    `*(Doctor's prescription attached)*`,
  ].filter((line) => line !== '');

  const text = lines.join('\n');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

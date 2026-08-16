/**
 * Offline Emergency Red-Flag Triage.
 *
 * CRITICAL SAFETY REQUIREMENT (06-DOMAIN-RULES.md §Red flags):
 * - Runs completely offline with ZERO network dependencies before any AI call.
 * - Matches English, Roman Urdu, and Urdu script keywords.
 * - False positives are acceptable; false negatives are NOT.
 * - Shows tap-to-call helpline numbers (Rescue 1122, Edhi 115, Chhipa 1020).
 */

export interface EmergencyHelpline {
  name: string;
  number: string;
  tel: string;
  description: string;
}

export const EMERGENCY_HELPLINES: EmergencyHelpline[] = [
  { name: 'Rescue 1122', number: '1122', tel: 'tel:1122', description: 'Medical & emergency ambulance' },
  { name: 'Edhi Ambulance', number: '115', tel: 'tel:115', description: 'Emergency ambulance & relief' },
  { name: 'Chhipa Ambulance', number: '1020', tel: 'tel:1020', description: 'Emergency rescue service' },
];

export interface RedFlagCategoryDefinition {
  id: string;
  label: string;
  keywords: string[];
}

export const RED_FLAG_CATEGORIES: RedFlagCategoryDefinition[] = [
  {
    id: 'cardiac',
    label: 'Cardiac Emergency',
    keywords: [
      'chest pain',
      'chest pressure',
      'chest tightness',
      'pain in chest',
      'seene me dard',
      'seene mein dard',
      'seena jakarna',
      'dil ka daura',
      'heart attack',
      'دل کا درد',
      'سینے میں درد',
      'دل کا دورہ',
    ],
  },
  {
    id: 'breathing',
    label: 'Severe Breathing Difficulty',
    keywords: [
      "can't breathe",
      'cant breathe',
      'cannot breathe',
      'shortness of breath',
      'difficulty breathing',
      'gasping',
      'saans nahi aa rahi',
      'saans phoolna',
      'saans band',
      'dam ghutna',
      'دم گھٹنا',
      'سانس نہیں آرہی',
    ],
  },
  {
    id: 'stroke',
    label: 'Stroke Symptoms',
    keywords: [
      'face drooping',
      'one side weakness',
      'slurred speech',
      "can't speak",
      'cant speak',
      'sudden numbness',
      'adha jism sun',
      'falij',
      'faalij',
      'فالج',
    ],
  },
  {
    id: 'bleeding',
    label: 'Severe Bleeding',
    keywords: [
      'heavy bleeding',
      "won't stop bleeding",
      'wont stop bleeding',
      'vomiting blood',
      'blood in vomit',
      'coughing blood',
      'khoon aa raha',
      'khoon ki ulti',
      'خون کی الٹی',
      'خون بہہ رہا',
    ],
  },
  {
    id: 'consciousness',
    label: 'Loss of Consciousness / Seizure',
    keywords: [
      'unconscious',
      'fainted',
      'passed out',
      'unresponsive',
      'seizure',
      'fit parna',
      'fits',
      'behosh',
      'be hosh',
      'dora parna',
      'بے ہوش',
      'دورہ',
    ],
  },
  {
    id: 'anaphylaxis',
    label: 'Severe Allergic Reaction',
    keywords: [
      'throat swelling',
      'tongue swelling',
      "can't swallow",
      'cant swallow',
      'severe allergic',
      'anaphylaxis',
      'whole body rash with breathing',
      'gala soojh',
      'gala phool',
    ],
  },
  {
    id: 'obstetric',
    label: 'Pregnancy Emergency',
    keywords: [
      'heavy bleeding pregnancy',
      'no fetal movement',
      'water broke early',
      'severe abdominal pain pregnancy',
      'hamal me khoon',
      'hamal mein dard',
    ],
  },
  {
    id: 'infant',
    label: 'Infant Emergency',
    keywords: [
      'baby not breathing',
      'baby blue',
      'baby limp',
      'newborn fever',
      'baby not waking',
      'bacha behosh',
      'bacha saans nahi le raha',
    ],
  },
  {
    id: 'poisoning',
    label: 'Poisoning / Overdose',
    keywords: [
      'overdose',
      'took too many pills',
      'swallowed poison',
      'zeher',
      'kerosene',
      'phenyl',
      'poison',
      'زہر',
    ],
  },
  {
    id: 'severe_headache',
    label: 'Sudden Severe Pain',
    keywords: [
      'worst headache of my life',
      'sudden severe headache',
      'thunderclap headache',
      'intehai shadeed sar dard',
    ],
  },
];

export interface RedFlagResult {
  isEmergency: boolean;
  matchedCategories: string[];
  matchedLabels: string[];
  emergencyNumbers: EmergencyHelpline[];
}

/**
 * Checks input text for high-risk red flag keywords.
 */
export function checkRedFlags(text: string | null | undefined): RedFlagResult {
  if (!text) {
    return {
      isEmergency: false,
      matchedCategories: [],
      matchedLabels: [],
      emergencyNumbers: EMERGENCY_HELPLINES,
    };
  }

  const normalized = text.toLowerCase();
  const matchedCategories: string[] = [];
  const matchedLabels: string[] = [];

  for (const category of RED_FLAG_CATEGORIES) {
    const hasMatch = category.keywords.some((kw) => normalized.includes(kw.toLowerCase()));
    if (hasMatch) {
      matchedCategories.push(category.id);
      matchedLabels.push(category.label);
    }
  }

  return {
    isEmergency: matchedCategories.length > 0,
    matchedCategories,
    matchedLabels,
    emergencyNumbers: EMERGENCY_HELPLINES,
  };
}

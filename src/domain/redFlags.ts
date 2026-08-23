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
      'chest discomfort',
      'chest heaviness',
      // Natural phrasings. People describe this symptom as a sentence, not as a
      // clinical noun, so the noun forms above are not enough on their own.
      'chest feels tight',
      'chest feels heavy',
      'chest feels like',
      'chest is tight',
      'chest is heavy',
      'chest hurts',
      'my chest hurt',
      'pain in chest',
      'pain in my chest',
      'tight chest',
      'heavy chest',
      'crushing pain',
      'pain in left arm',
      'seene me dard',
      'seene mein dard',
      'seena jakarna',
      'chaati me dard',
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
      'unable to breathe',
      'trouble breathing',
      'hard to breathe',
      'shortness of breath',
      'short of breath',
      'breathless',
      'difficulty breathing',
      'struggling to breathe',
      'gasping',
      'choking',
      'saans nahi aa rahi',
      'saans phoolna',
      'saans band',
      'saans lene me',
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
      'face is drooping',
      'one side weakness',
      'weak on one side',
      'one side of my body',
      'slurred speech',
      "can't speak",
      'cant speak',
      'cannot speak',
      "can't move my arm",
      'sudden numbness',
      'sudden confusion',
      'vision loss',
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
      'will not stop bleeding',
      'bleeding a lot',
      'vomiting blood',
      'blood in vomit',
      'coughing blood',
      'coughing up blood',
      'blood in stool',
      'black stool',
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
      'passing out',
      'unresponsive',
      "won't wake up",
      'wont wake up',
      'not waking up',
      'seizure',
      'convulsion',
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
      'throat is swelling',
      'throat closing',
      'tongue swelling',
      'lips swelling',
      "can't swallow",
      'cant swallow',
      'cannot swallow',
      'severe allergic',
      'allergic reaction',
      'anaphylaxis',
      'whole body rash with breathing',
      'hives all over',
      'gala soojh',
      'gala phool',
    ],
  },
  {
    id: 'obstetric',
    label: 'Pregnancy Emergency',
    keywords: [
      'heavy bleeding pregnancy',
      'bleeding while pregnant',
      'bleeding during pregnancy',
      'no fetal movement',
      'baby not moving',
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
      'baby is blue',
      'baby limp',
      'newborn fever',
      'baby not waking',
      "baby won't wake",
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
      'took too many tablets',
      'double dose by mistake',
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
      'worst headache ever',
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
 * Normalises text before keyword matching.
 *
 * Mobile keyboards auto-substitute a typographic apostrophe (U+2019), so a real
 * user typing "can't breathe" produced "can’t breathe" and matched nothing. Same
 * for collapsed whitespace and stray punctuation. False negatives are the one
 * failure mode this module must not have.
 */
export function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ′`´]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[.,!?;:()[\]{}"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  const normalized = normalizeForMatching(text);
  const matchedCategories: string[] = [];
  const matchedLabels: string[] = [];

  for (const category of RED_FLAG_CATEGORIES) {
    const hasMatch = category.keywords.some((kw) =>
      normalized.includes(normalizeForMatching(kw))
    );
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

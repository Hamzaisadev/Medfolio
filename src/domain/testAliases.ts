/**
 * Medical Lab Test Name Normalization & Alias Resolution.
 *
 * Implements authoritative mapping per 06-DOMAIN-RULES.md:
 * - Links lab report items (printed names) to doctor orders (shorthand/abbreviations).
 * - Exact normalization ONLY (NO fuzzy/substring matching to avoid clinical confusion between e.g. Vit D and Vit B12).
 */

export interface TestDefinition {
  canonical: string;
  aliases: string[];
}

export const TEST_DEFINITIONS: TestDefinition[] = [
  { canonical: 'Complete Blood Count', aliases: ['cbc', 'blood cp', 'cp', 'complete picture', 'complete blood count'] },
  { canonical: 'Hemoglobin', aliases: ['hb', 'haemoglobin', 'hemoglobin'] },
  { canonical: 'Liver Function Test', aliases: ['lft', 'lfts', 'liver profile', 'liver function', 'liver function test'] },
  { canonical: 'Renal Function Test', aliases: ['rft', 'rfts', 'kft', 'kidney function', 'renal profile', 'renal function test'] },
  { canonical: 'Glycated Hemoglobin', aliases: ['hba1c', 'a1c', 'glycated hb', 'glycated hemoglobin'] },
  { canonical: 'Thyroid Stimulating Hormone', aliases: ['tsh', 'thyroid stimulating hormone'] },
  { canonical: 'Thyroid Panel', aliases: ['t3', 't4', 'ft3', 'ft4', 'tft', 'tfts', 'thyroid profile', 'thyroid panel'] },
  { canonical: 'Erythrocyte Sedimentation Rate', aliases: ['esr', 'erythrocyte sedimentation rate'] },
  { canonical: 'C-Reactive Protein', aliases: ['crp', 'c reactive protein'] },
  { canonical: 'Fasting Blood Sugar', aliases: ['fbs', 'fasting sugar', 'fasting glucose', 'fasting blood sugar'] },
  { canonical: 'Random Blood Sugar', aliases: ['rbs', 'random sugar', 'random glucose', 'random blood sugar'] },
  { canonical: 'Oral Glucose Tolerance Test', aliases: ['ogtt', 'oral glucose tolerance test'] },
  { canonical: 'Lipid Profile', aliases: ['lipids', 'lipid profile', 'cholesterol profile'] },
  { canonical: 'Urine Detailed Report', aliases: ['udr', 'urine dr', 'urine d/r', 'urine complete', 'urine detailed report'] },
  { canonical: 'Chest X-Ray', aliases: ['x ray', 'xray', 'cxr', 'chest x ray', 'chest xray'] },
  { canonical: 'Ultrasound', aliases: ['usg', 'ultrasound', 'u s', 'sonography'] },
  { canonical: 'Electrocardiogram', aliases: ['ecg', 'ekg', 'electrocardiogram'] },
  { canonical: 'Echocardiogram', aliases: ['echo', 'echocardiogram', '2d echo'] },
  { canonical: 'Vitamin D', aliases: ['vit d', '25 oh vitamin d', 'vitamin d3', 'vitamin d'] },
  { canonical: 'Vitamin B12', aliases: ['vit b12', 'b12', 'cobalamin', 'vitamin b12'] },
  { canonical: 'Serum Creatinine', aliases: ['s creatinine', 'creat', 'creatinine', 'serum creatinine', 'creatine', 's creat', 'cr'] },
  { canonical: 'Serum Electrolytes', aliases: ['s electrolytes', 'electrolytes', 'serum electrolytes'] },
  { canonical: 'Dengue NS1 Antigen', aliases: ['dengue ns1', 'ns1', 'dengue antigen', 'dengue ns1 antigen'] },
  { canonical: 'Typhoid Serology', aliases: ['typhidot', 'widal', 'typhoid serology'] },
  { canonical: 'Malaria Test', aliases: ['mp', 'malarial parasite', 'ict malaria', 'malaria test'] },
  { canonical: 'Hepatitis B Surface Antigen', aliases: ['hbsag', 'hepatitis b surface antigen'] },
  { canonical: 'Hepatitis C Antibody', aliases: ['anti hcv', 'hcv', 'anti-hcv', 'hepatitis c antibody'] },
  { canonical: 'Prothrombin Time / INR', aliases: ['pt inr', 'inr', 'pt', 'pt/inr', 'prothrombin time'] },
  { canonical: 'Serum Uric Acid', aliases: ['uric acid', 'serum uric acid', 's uric acid'] },
  { canonical: 'Prostate Specific Antigen', aliases: ['psa', 'prostate specific antigen'] },
  { canonical: 'Beta HCG', aliases: ['beta hcg', 'b hcg', 'b-hcg'] },
  { canonical: 'ALT / SGPT', aliases: ['alt', 'sgpt', 'alanine aminotransferase', 's.g.p.t', 'alt/sgpt', 'alt (sgpt)', 'sgpt (alt)', 's alt', 's sgpt'] },
  { canonical: 'AST / SGOT', aliases: ['ast', 'sgot', 'aspartate aminotransferase', 's.g.o.t', 'ast/sgot', 'ast (sgot)', 'sgot (ast)', 's ast', 's sgot'] },
  { canonical: 'Total Bilirubin', aliases: ['total bilirubin', 't bilirubin', 's bilirubin total', 't. bili', 'bilirubin total', 'bilirubin'] },
  { canonical: 'Serum Urea / BUN', aliases: ['urea', 'serum urea', 'bun', 'blood urea nitrogen', 's urea'] },
  { canonical: 'Total Cholesterol', aliases: ['total cholesterol', 'cholesterol', 't cholesterol', 's cholesterol'] },
  { canonical: 'HDL Cholesterol', aliases: ['hdl', 'hdl cholesterol', 'hdl c', 'hdl-c', 'high density lipoprotein'] },
  { canonical: 'LDL Cholesterol', aliases: ['ldl', 'ldl cholesterol', 'ldl c', 'ldl-c', 'low density lipoprotein'] },
  { canonical: 'Triglycerides', aliases: ['triglycerides', 'tg', 'trigs', 'serum triglycerides', 's triglycerides'] },
  { canonical: 'Serum Calcium', aliases: ['calcium', 'serum calcium', 's calcium', 'ca'] },
  { canonical: 'Platelet Count', aliases: ['platelets', 'platelet count', 'plt', 'platelet'] },
  { canonical: 'White Blood Cell Count', aliases: ['wbc', 'tlc', 'total leukocyte count', 'white blood cells', 'wbc count'] },
  { canonical: 'Red Blood Cell Count', aliases: ['rbc', 'trbc', 'red blood cells', 'rbc count'] },
];

/**
 * Normalizes strings by lowercasing, stripping punctuation, and collapsing whitespace.
 */
export function normalizeTestName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves a raw test name to its standardized canonical lab test name.
 * Returns null if no exact or alias match exists.
 */
export function resolveCanonicalTestName(rawName: string | null | undefined): string | null {
  if (!rawName) return null;
  const normalized = normalizeTestName(rawName);
  if (!normalized) return null;

  for (const def of TEST_DEFINITIONS) {
    if (normalizeTestName(def.canonical) === normalized) {
      return def.canonical;
    }
    for (const alias of def.aliases) {
      if (normalizeTestName(alias) === normalized) {
        return def.canonical;
      }
    }
  }

  return null;
}

/**
 * Formats a raw test name into a clean, standardized display name.
 * Returns the canonical name if recognized, or clean Title Case if unmapped.
 */
export function getStandardTestName(rawName: string | null | undefined): string {
  if (!rawName) return '';
  const canonical = resolveCanonicalTestName(rawName);
  if (canonical) return canonical;

  const cleaned = rawName.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  // If text is all uppercase or all lowercase, convert to Title Case for uniform display
  if (cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase()) {
    return cleaned
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return cleaned;
}

/**
 * Matches two test names to determine if they refer to the same clinical investigation.
 */
export function areTestsEquivalent(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;

  const canonA = resolveCanonicalTestName(nameA);
  const canonB = resolveCanonicalTestName(nameB);

  if (canonA && canonB) {
    return canonA === canonB;
  }

  if (canonA && !canonB) {
    return normalizeTestName(canonA) === normalizeTestName(nameB);
  }

  if (!canonA && canonB) {
    return normalizeTestName(nameA) === normalizeTestName(canonB);
  }

  return normalizeTestName(nameA) === normalizeTestName(nameB);
}

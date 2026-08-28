import { GENERIC_MOLECULE_REGISTRY, type GenericMoleculeInfo } from './clinicalKnowledge';

export interface SentinelAlert {
  type: 'duplicate_generic' | 'cumulative_overdose' | 'class_overlap';
  severity: 'critical' | 'high' | 'moderate';
  genericName: string;
  drugClass: string;
  involvedBrands: string[];
  cumulativeDailyDoseMg?: number;
  maxSafeDailyDoseMg?: number;
  unit: string;
  clinicalMessage: string;
  actionRecommendation: string;
}

export interface ActiveMedInput {
  medicine_name: string;
  strength?: string | null;
  frequency_code?: string | null;
  dose_amount?: string | null;
  instructions?: string | null;
}

/**
 * Parses daily dose count multiplier from frequency string or raw code.
 */
export function parseDailyFrequencyMultiplier(frequency?: string | null): number {
  if (!frequency) return 1;
  const f = frequency.trim().toLowerCase();

  // Pattern "1-1-1", "1-0-1", "2-0-2", etc.
  const dashPattern = f.match(/^(\d+)[-–](\d+)[-–](\d+)(?:[-–](\d+))?$/);
  if (dashPattern) {
    const d1 = parseInt(dashPattern[1] || '0', 10) || 0;
    const d2 = parseInt(dashPattern[2] || '0', 10) || 0;
    const d3 = parseInt(dashPattern[3] || '0', 10) || 0;
    const d4 = dashPattern[4] ? parseInt(dashPattern[4] || '0', 10) || 0 : 0;
    return Math.max(1, d1 + d2 + d3 + d4);
  }

  if (f === 'od' || f === 'once daily' || f === 'daily' || f === 'q24h' || f === 'hs') return 1;
  if (f === 'bd' || f === 'bid' || f === 'twice daily' || f === 'q12h' || f === '1-0-1') return 2;
  if (f === 'tds' || f === 'tid' || f === 'thrice daily' || f === 'q8h' || f === '1-1-1') return 3;
  if (f === 'qid' || f === 'four times daily' || f === 'q6h') return 4;
  if (f === 'prn' || f === 'as needed') return 2; // Conservative assumption for PRN calculation

  return 1;
}

/**
 * Extracts numerical milligram value from strength string (e.g. "500mg", "1g", "625mg", "20 mg").
 */
export function parseStrengthInMg(strengthStr?: string | null, medName?: string): number {
  const combined = `${medName || ''} ${strengthStr || ''}`.toLowerCase();

  // Grams e.g. "1g" or "1.2g"
  const gramMatch = combined.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (gramMatch && !combined.includes('mg')) {
    return parseFloat(gramMatch[1] || '0') * 1000;
  }

  // Milligrams e.g. "500mg" or "500 mg"
  const mgMatch = combined.match(/(\d+(?:\.\d+)?)\s*mg\b/);
  if (mgMatch) {
    return parseFloat(mgMatch[1] || '0');
  }

  // Micrograms e.g. "100mcg" or "50 mcg"
  const mcgMatch = combined.match(/(\d+(?:\.\d+)?)\s*mcg\b/);
  if (mcgMatch) {
    return parseFloat(mcgMatch[1] || '0') / 1000;
  }

  return 0;
}

/**
 * Matches a drug name/brand string against the Generic Molecule Registry.
 */
export function matchGenericMolecule(medName: string): GenericMoleculeInfo | null {
  const cleanName = medName.toLowerCase().trim();

  for (const mol of GENERIC_MOLECULE_REGISTRY) {
    if (cleanName.includes(mol.genericName.toLowerCase())) {
      return mol;
    }
    for (const alias of mol.brandAliases) {
      // Word boundary match or exact substring
      const regex = new RegExp(`\\b${alias.toLowerCase()}\\b`, 'i');
      if (regex.test(cleanName) || cleanName.startsWith(alias.toLowerCase())) {
        return mol;
      }
    }
  }

  return null;
}

/**
 * Executes comprehensive safety sentinel analysis on active patient medicines and queried text.
 */
export function analyzeSafetySentinel(
  activeMeds: ActiveMedInput[] = [],
  queriedText = ''
): { alerts: SentinelAlert[]; alertPromptDirectives: string[] } {
  const alerts: SentinelAlert[] = [];
  const alertPromptDirectives: string[] = [];

  // 1. Group active and queried medicines by Generic Molecule
  const moleculeMap = new Map<
    string,
    {
      molecule: GenericMoleculeInfo;
      items: Array<{ name: string; strengthMg: number; dailyFreq: number; totalDailyMg: number }>;
    }
  >();

  // Helper to register medicine item
  const registerItem = (name: string, strength?: string | null, freq?: string | null) => {
    const matched = matchGenericMolecule(name);
    if (!matched) return;

    let strengthMg = parseStrengthInMg(strength, name);
    // If strength is 0, assign standard clinical default strength
    if (strengthMg === 0) {
      if (matched.genericName.includes('Paracetamol')) strengthMg = 500;
      else if (matched.genericName.includes('Ibuprofen')) strengthMg = 400;
      else if (matched.genericName.includes('Diclofenac')) strengthMg = 50;
      else if (matched.genericName.includes('Omeprazole')) strengthMg = 20;
      else if (matched.genericName.includes('Atorvastatin')) strengthMg = 20;
    }

    const dailyFreq = parseDailyFrequencyMultiplier(freq);
    const totalDailyMg = strengthMg * dailyFreq;

    if (!moleculeMap.has(matched.genericName)) {
      moleculeMap.set(matched.genericName, { molecule: matched, items: [] });
    }

    moleculeMap.get(matched.genericName)!.items.push({
      name,
      strengthMg,
      dailyFreq,
      totalDailyMg,
    });
  };

  // Process all active medicines
  activeMeds.forEach((m) => {
    registerItem(m.medicine_name, m.strength, m.frequency_code);
  });

  // Extract any newly queried drug names mentioned in user text
  const qLower = queriedText.toLowerCase();
  GENERIC_MOLECULE_REGISTRY.forEach((mol) => {
    mol.brandAliases.forEach((alias) => {
      const regex = new RegExp(`\\b${alias.toLowerCase()}\\b`, 'i');
      if (regex.test(qLower)) {
        // Check if not already in activeMeds
        const alreadyPresent = activeMeds.some((m) =>
          m.medicine_name.toLowerCase().includes(alias.toLowerCase())
        );
        if (!alreadyPresent) {
          // Extract strength near the brand if possible
          const snippetMatch = qLower.match(new RegExp(`${alias.toLowerCase()}\\s*(\\d+\\s*(?:mg|g)?)`, 'i'));
          const extractedStrength = snippetMatch ? snippetMatch[1] : undefined;
          registerItem(alias, extractedStrength, '1');
        }
      }
    });
  });

  // 2. Evaluate Duplicate Active Ingredients & Cumulative Dosages
  moleculeMap.forEach((entry, genericName) => {
    const { molecule, items } = entry;
    const distinctNames = Array.from(new Set(items.map((i) => i.name)));
    const cumulativeDailyDoseMg = items.reduce((acc, curr) => acc + curr.totalDailyMg, 0);

    // Duplicate generic active ingredient under multiple brand names
    if (distinctNames.length > 1) {
      alerts.push({
        type: 'duplicate_generic',
        severity: 'high',
        genericName,
        drugClass: molecule.drugClass,
        involvedBrands: distinctNames,
        cumulativeDailyDoseMg,
        maxSafeDailyDoseMg: molecule.maxDailyDoseMg,
        unit: molecule.unit,
        clinicalMessage: `Duplicate active molecule detected: You have multiple brands containing ${genericName} (${distinctNames.join(', ')}). Taking different brands of the same medication simultaneously can cause accidental overdose.`,
        actionRecommendation: `Verify with your pharmacist or doctor to select a single prescribed brand and discontinue duplicate formulations.`,
      });

      alertPromptDirectives.push(
        `[SENTINEL ALERT - DUPLICATE DRUG]: Patient is taking multiple brands containing ${genericName} (${distinctNames.join(', ')}). Warn them clearly that these are the same active medicine under different names.`
      );
    }

    // Cumulative Overdose Check
    if (molecule.maxDailyDoseMg && cumulativeDailyDoseMg >= molecule.maxDailyDoseMg) {
      const isCritical = cumulativeDailyDoseMg > molecule.maxDailyDoseMg;
      alerts.push({
        type: 'cumulative_overdose',
        severity: isCritical ? 'critical' : 'high',
        genericName,
        drugClass: molecule.drugClass,
        involvedBrands: distinctNames,
        cumulativeDailyDoseMg,
        maxSafeDailyDoseMg: molecule.maxDailyDoseMg,
        unit: molecule.unit,
        clinicalMessage: `Cumulative 24-hour dose of ${genericName} is ${cumulativeDailyDoseMg}${molecule.unit}, which ${isCritical ? 'EXCEEDS' : 'reaches'} the maximum safe clinical limit of ${molecule.maxDailyDoseMg}${molecule.unit}/day. Toxicity risk: ${molecule.toxicityRisk}`,
        actionRecommendation: `Immediately reduce daily intake to not exceed ${molecule.maxDailyDoseMg}${molecule.unit} in 24 hours. Check all OTC syrups and combination pain medications.`,
      });

      alertPromptDirectives.push(
        `[SENTINEL ALERT - OVERDOSE RISK]: Cumulative daily dose of ${genericName} is ${cumulativeDailyDoseMg}${molecule.unit} (Safe ceiling: ${molecule.maxDailyDoseMg}${molecule.unit}/day). ${molecule.toxicityRisk} MUST warn patient prominently.`
      );
    }
  });

  // 3. Evaluate Therapeutic Class Duplication (e.g. Multiple NSAIDs)
  const nsaidItems = Array.from(moleculeMap.values()).filter((e) => e.molecule.isNsaid);
  if (nsaidItems.length > 1) {
    const nsaidBrands = nsaidItems.flatMap((e) => e.items.map((i) => i.name));
    alerts.push({
      type: 'class_overlap',
      severity: 'critical',
      genericName: 'Multiple NSAIDs Concurrent Therapy',
      drugClass: 'Non-Steroidal Anti-Inflammatory Drugs',
      involvedBrands: nsaidBrands,
      unit: 'mg',
      clinicalMessage: `Concurrent multiple NSAID use detected (${nsaidBrands.join(' + ')}). Combining different NSAIDs does NOT enhance pain relief but exponentially increases the risk of acute gastric bleeding, peptic ulcers, and kidney failure.`,
      actionRecommendation: `Use only ONE anti-inflammatory medicine at a time. For breakthrough pain, switch to Paracetamol under medical guidance.`,
    });

    alertPromptDirectives.push(
      `[SENTINEL ALERT - MULTI-NSAID OVERLAP]: Patient is taking multiple NSAIDs simultaneously (${nsaidBrands.join(', ')}). Explain the compounded gastric ulcer and renal toxicity risk and advise using only one NSAID.`
    );
  }

  // 4. Multiple PPIs Concurrent Therapy
  const ppiItems = Array.from(moleculeMap.values()).filter((e) => e.molecule.isPpi);
  if (ppiItems.length > 1) {
    const ppiBrands = ppiItems.flatMap((e) => e.items.map((i) => i.name));
    alerts.push({
      type: 'class_overlap',
      severity: 'moderate',
      genericName: 'Duplicate Proton Pump Inhibitors (PPIs)',
      drugClass: 'Proton Pump Inhibitors',
      involvedBrands: ppiBrands,
      unit: 'mg',
      clinicalMessage: `Duplicate PPI therapy detected (${ppiBrands.join(' + ')}). Taking two different acid-suppressing PPIs is redundant and increases long-term risk of hypomagnesemia and infection.`,
      actionRecommendation: `Consolidate to a single daily PPI taken 30-60 minutes before breakfast.`,
    });
  }

  return { alerts, alertPromptDirectives };
}

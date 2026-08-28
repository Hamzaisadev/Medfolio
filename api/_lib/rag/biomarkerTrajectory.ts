/**
 * Longitudinal Lab Biomarker Trajectory & Predictive Trend Engine for Medfolio RAG.
 * Evaluates chronological biomarker progressions (delta, velocity, clinical significance)
 * to detect organ strain, glycemic drift, and therapeutic responses over time.
 */

export interface BiomarkerReading {
  reportDate: string;
  reportTitle: string;
  rawTestName: string;
  numericValue: number;
  valueText: string;
  unit: string;
  referenceRange?: string | null;
  rangeStatus?: string | null;
}

export interface BiomarkerTrajectoryItem {
  canonicalKey: string;
  displayName: string;
  unit: string;
  readings: BiomarkerReading[];
  firstValue: number;
  latestValue: number;
  deltaValue: number;
  deltaPercent: number;
  trendStatus: 'worsening' | 'improving' | 'stable' | 'fluctuating';
  clinicalSignificance: string;
  predictiveAlert?: string;
  drugCorrelates: string[];
}

export interface LabReportInput {
  title: string;
  report_date: string;
  results: Array<{
    test_name: string;
    value_text: string;
    unit?: string | null;
    reference_range?: string | null;
    range_status?: string | null;
  }>;
}

/**
 * Maps raw test names to canonical biomarker keys with reference limits.
 */
interface CanonicalTestDef {
  key: string;
  displayName: string;
  aliases: string[];
  unit: string;
  normalMin?: number;
  normalMax?: number;
  higherIsWorse: boolean;
  criticalThreshold?: number;
  drugCorrelates: string[];
  clinicalContext: (item: BiomarkerTrajectoryItem) => { insight: string; alert?: string };
}

const CANONICAL_TEST_DEFINITIONS: CanonicalTestDef[] = [
  {
    key: 'hba1c',
    displayName: 'HbA1c (Glycated Hemoglobin)',
    aliases: ['hba1c', 'a1c', 'glycated hemoglobin', 'glycosylated hb', 'hb a1c'],
    unit: '%',
    normalMin: 4.0,
    normalMax: 5.7,
    higherIsWorse: true,
    criticalThreshold: 8.0,
    drugCorrelates: ['Metformin', 'Glimepiride', 'Empagliflozin', 'Sitagliptin', 'Insulin'],
    clinicalContext: (item) => {
      if (item.deltaValue > 0.4 && item.latestValue >= 6.5) {
        return {
          insight: `HbA1c rose by +${item.deltaValue.toFixed(1)}% (${item.firstValue}% → ${item.latestValue}%), indicating progressive loss of glycemic control.`,
          alert: `Progressive hyperglycemia detected. Re-evaluate antidiabetic regimen adherence and dietary carbohydrate intake with your endocrinologist.`,
        };
      }
      if (item.deltaValue < -0.4) {
        return {
          insight: `HbA1c improved by ${item.deltaValue.toFixed(1)}% (${item.firstValue}% → ${item.latestValue}%), indicating favorable therapeutic response.`,
        };
      }
      return {
        insight: `HbA1c is currently ${item.latestValue}% (Baseline: ${item.firstValue}%).`,
      };
    },
  },
  {
    key: 'creatinine',
    displayName: 'Serum Creatinine',
    aliases: ['creatinine', 's. creatinine', 's. creat', 'serum creat', 'cr'],
    unit: 'mg/dL',
    normalMin: 0.6,
    normalMax: 1.2,
    higherIsWorse: true,
    criticalThreshold: 1.5,
    drugCorrelates: ['Diclofenac', 'Ibuprofen', 'Naproxen', 'Metformin', 'ACE Inhibitors', 'Gentamicin'],
    clinicalContext: (item) => {
      if (item.deltaValue >= 0.3 && item.latestValue > 1.2) {
        return {
          insight: `Serum Creatinine rose by +${item.deltaValue.toFixed(2)} mg/dL (${item.firstValue} → ${item.latestValue} mg/dL). A sustained rise ≥ 0.3 mg/dL signals declining glomerular filtration.`,
          alert: `Early renal strain warning: If taking NSAIDs (Diclofenac/Brufen) or Metformin, consult doctor to check eGFR and adjust renally cleared drug doses.`,
        };
      }
      if (item.latestValue > 1.3) {
        return {
          insight: `Serum Creatinine elevated at ${item.latestValue} mg/dL.`,
          alert: `Elevated creatinine indicates reduced renal clearance. Caution with nephrotoxic drugs.`,
        };
      }
      return {
        insight: `Serum Creatinine stable at ${item.latestValue} mg/dL (Baseline: ${item.firstValue} mg/dL).`,
      };
    },
  },
  {
    key: 'alt_sgpt',
    displayName: 'ALT / SGPT (Liver Enzyme)',
    aliases: ['alt', 'sgpt', 'alanine aminotransferase', 's.g.p.t'],
    unit: 'U/L',
    normalMin: 7,
    normalMax: 50,
    higherIsWorse: true,
    criticalThreshold: 100,
    drugCorrelates: ['Atorvastatin', 'Rosuvastatin', 'Paracetamol', 'Augmentin', 'Anti-TB Drugs'],
    clinicalContext: (item) => {
      if (item.latestValue > 80) {
        return {
          insight: `ALT/SGPT elevated at ${item.latestValue} U/L (${item.firstValue} → ${item.latestValue} U/L), indicating hepatocellular stress or drug-induced liver inflammation.`,
          alert: `Hepatic transaminase elevation: Monitor statin therapy (Atorvastatin) and avoid high paracetamol intake or hepatotoxic substances.`,
        };
      }
      if (item.deltaValue < -15 && item.latestValue <= 50) {
        return {
          insight: `ALT/SGPT normalized to ${item.latestValue} U/L (down from ${item.firstValue} U/L), indicating liver recovery.`,
        };
      }
      return {
        insight: `ALT/SGPT currently ${item.latestValue} U/L.`,
      };
    },
  },
  {
    key: 'ldl',
    displayName: 'LDL Cholesterol (Bad Cholesterol)',
    aliases: ['ldl', 'ldl-c', 'ldl cholesterol', 'low density lipoprotein'],
    unit: 'mg/dL',
    normalMin: 0,
    normalMax: 100,
    higherIsWorse: true,
    criticalThreshold: 160,
    drugCorrelates: ['Atorvastatin', 'Rosuvastatin', 'Ezetimibe'],
    clinicalContext: (item) => {
      if (item.deltaValue <= -25) {
        return {
          insight: `LDL dropped significantly by ${Math.abs(item.deltaPercent).toFixed(0)}% (${item.firstValue} → ${item.latestValue} mg/dL), confirming excellent statin lipid-lowering efficacy.`,
        };
      }
      if (item.latestValue > 130) {
        return {
          insight: `LDL Cholesterol elevated at ${item.latestValue} mg/dL (Target for high cardiovascular risk is < 70-100 mg/dL).`,
          alert: `Elevated atherogenic lipid levels increase cardiovascular plaque risk. Discuss lipid optimization with your doctor.`,
        };
      }
      return {
        insight: `LDL Cholesterol is ${item.latestValue} mg/dL.`,
      };
    },
  },
  {
    key: 'tsh',
    displayName: 'TSH (Thyroid Stimulating Hormone)',
    aliases: ['tsh', 'thyrotropin', 'thyroid stimulating hormone'],
    unit: 'mIU/L',
    normalMin: 0.4,
    normalMax: 4.5,
    higherIsWorse: false,
    criticalThreshold: 10.0,
    drugCorrelates: ['Levothyroxine', 'Thyroxine', 'Carbimazole', 'Amiodarone'],
    clinicalContext: (item) => {
      if (item.latestValue > 5.0) {
        return {
          insight: `TSH elevated at ${item.latestValue} mIU/L (${item.firstValue} → ${item.latestValue} mIU/L), reflecting underactive thyroid or inadequate Thyroxine replacement dose.`,
          alert: `Hypothyroid state: Review Levothyroxine dose and ensure it is taken strictly on an empty stomach with plain water.`,
        };
      }
      if (item.latestValue < 0.3) {
        return {
          insight: `TSH suppressed at ${item.latestValue} mIU/L, suggesting potential over-replacement of thyroid hormone.`,
          alert: `Low TSH warning: Over-replacement of Thyroxine can cause palpitations, bone loss, and atrial fibrillation. Consult physician.`,
        };
      }
      return {
        insight: `TSH is within euthyroid range at ${item.latestValue} mIU/L.`,
      };
    },
  },
  {
    key: 'fbs',
    displayName: 'Fasting Blood Glucose',
    aliases: ['fbs', 'fasting blood sugar', 'fasting glucose', 'bsr fasting', 'fpg'],
    unit: 'mg/dL',
    normalMin: 70,
    normalMax: 99,
    higherIsWorse: true,
    criticalThreshold: 180,
    drugCorrelates: ['Metformin', 'Insulin', 'Glimepiride', 'Empagliflozin'],
    clinicalContext: (item) => {
      if (item.latestValue >= 126) {
        return {
          insight: `Fasting Blood Glucose elevated at ${item.latestValue} mg/dL (Baseline: ${item.firstValue} mg/dL), crossing the diabetic diagnostic threshold (≥ 126 mg/dL).`,
          alert: `Elevated fasting glucose. Correlate with HbA1c and maintain antidiabetic dosing schedule.`,
        };
      }
      if (item.latestValue < 70) {
        return {
          insight: `Fasting Blood Glucose is low at ${item.latestValue} mg/dL (Hypoglycemia threshold < 70 mg/dL).`,
          alert: `Hypoglycemia alert: Symptoms include sweating, tremors, and lightheadedness. Treat immediately with 15g fast-acting carbohydrates.`,
        };
      }
      return {
        insight: `Fasting Blood Glucose is ${item.latestValue} mg/dL.`,
      };
    },
  },
];

/**
 * Extracts numerical floating point value from test value string (e.g. "7.2 %", "1.4 mg/dl", "145", "< 0.01").
 */
function parseNumericTestValue(valStr?: string): number | null {
  if (!valStr) return null;
  const match = valStr.match(/([0-9]+(?:\.[0-9]+)?)/);
  return match && match[1] ? parseFloat(match[1]) : null;
}

/**
 * Analyzes chronological biomarker trajectories across all patient reports.
 */
export function analyzeBiomarkerTrajectories(
  reports: LabReportInput[] = []
): {
  trajectories: BiomarkerTrajectoryItem[];
  trajectoryPromptDirectives: string[];
} {
  const trajectories: BiomarkerTrajectoryItem[] = [];
  const trajectoryPromptDirectives: string[] = [];

  // Sort reports chronologically (oldest to newest)
  const sortedReports = [...reports].sort(
    (a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime()
  );

  // Group extracted readings by canonical test
  CANONICAL_TEST_DEFINITIONS.forEach((def) => {
    const readings: BiomarkerReading[] = [];

    sortedReports.forEach((rep) => {
      rep.results.forEach((res) => {
        const rawLower = res.test_name.toLowerCase().trim();
        const matchesDef = def.aliases.some(
          (alias) => rawLower === alias || rawLower.includes(alias)
        );

        if (matchesDef) {
          const num = parseNumericTestValue(res.value_text);
          if (num !== null) {
            readings.push({
              reportDate: rep.report_date,
              reportTitle: rep.title,
              rawTestName: res.test_name,
              numericValue: num,
              valueText: res.value_text,
              unit: res.unit || def.unit,
              referenceRange: res.reference_range,
              rangeStatus: res.range_status,
            });
          }
        }
      });
    });

    if (readings.length > 0) {
      const first = readings[0];
      const latest = readings[readings.length - 1];
      if (!first || !latest) return;

      const deltaVal = latest.numericValue - first.numericValue;
      const deltaPct = first.numericValue !== 0 ? (deltaVal / first.numericValue) * 100 : 0;

      let trendStatus: BiomarkerTrajectoryItem['trendStatus'] = 'stable';
      if (Math.abs(deltaPct) < 5) {
        trendStatus = 'stable';
      } else if (def.higherIsWorse) {
        trendStatus = deltaVal > 0 ? 'worsening' : 'improving';
      } else {
        trendStatus = deltaVal < 0 ? 'worsening' : 'improving';
      }

      // If multiple readings fluctuate
      if (readings.length >= 3) {
        let ups = 0;
        let downs = 0;
        for (let i = 1; i < readings.length; i++) {
          const curr = readings[i];
          const prev = readings[i - 1];
          if (curr && prev) {
            if (curr.numericValue > prev.numericValue) ups++;
            else if (curr.numericValue < prev.numericValue) downs++;
          }
        }
        if (ups > 0 && downs > 0 && Math.abs(deltaPct) < 15) {
          trendStatus = 'fluctuating';
        }
      }

      const item: BiomarkerTrajectoryItem = {
        canonicalKey: def.key,
        displayName: def.displayName,
        unit: def.unit,
        readings,
        firstValue: first.numericValue,
        latestValue: latest.numericValue,
        deltaValue: deltaVal,
        deltaPercent: deltaPct,
        trendStatus,
        clinicalSignificance: '',
        drugCorrelates: def.drugCorrelates,
      };

      const { insight, alert } = def.clinicalContext(item);
      item.clinicalSignificance = insight;
      item.predictiveAlert = alert;

      trajectories.push(item);

      // Generate prompt directive
      let directive = `[BIOMARKER TRAJECTORY: ${def.displayName}] `;
      directive += `Timeline (${readings.map((r) => `${r.reportDate}: ${r.valueText} ${r.unit}`).join(' → ')}). `;
      directive += `Delta: ${deltaVal >= 0 ? '+' : ''}${deltaVal.toFixed(1)} ${def.unit} (${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%). `;
      directive += `Insight: ${insight} `;
      if (alert) {
        directive += `CRITICAL PREDICTIVE ALERT: ${alert}`;
      }

      trajectoryPromptDirectives.push(directive);
    }
  });

  return { trajectories, trajectoryPromptDirectives };
}

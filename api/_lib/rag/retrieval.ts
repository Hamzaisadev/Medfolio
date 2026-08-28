import {
  DRUG_KNOWLEDGE_CORPUS,
  BIOMARKER_KNOWLEDGE_CORPUS,
  GENERIC_MOLECULE_REGISTRY,
} from './clinicalKnowledge';
import { analyzeSafetySentinel, type SentinelAlert } from './sentinel';
import {
  analyzeBiomarkerTrajectories,
  type BiomarkerTrajectoryItem,
} from './biomarkerTrajectory';

export interface RetrievedCitation {
  source: string;
  type: 'clinical_guideline' | 'patient_prescription' | 'patient_lab_result' | 'patient_consultation' | 'safety_sentinel' | 'biomarker_trajectory';
  detail: string;
}

export interface RagRetrievalResult {
  retrievedClinicalRules: string[];
  retrievedPatientEvidence: string[];
  citations: RetrievedCitation[];
  sentinelAlerts: SentinelAlert[];
  biomarkerTrajectories: BiomarkerTrajectoryItem[];
  queryIntent: 'interaction_check' | 'lab_interpretation' | 'dosing_timing' | 'pregnancy_lactation' | 'pre_op' | 'overdose_sentinel' | 'general_clinical';
  resolvedContextQuery: string;
}

export interface PatientContextInput {
  profile?: {
    full_name?: string | null;
    sex?: string | null;
    date_of_birth?: string | null;
    allergies?: string | null;
    chronic_conditions?: string | null;
  } | null;
  activeMedicines?: Array<{
    medicine_name: string;
    strength?: string | null;
    frequency_code?: string | null;
    start_date?: string | null;
    with_food?: boolean | null;
    instructions?: string | null;
  }>;
  recentVisits?: Array<{
    doctor_name?: string | null;
    visit_date?: string | null;
    diagnosis?: string | null;
    doctor_advice?: string | null;
  }>;
  recentReports?: Array<{
    title: string;
    report_date: string;
    results: Array<{
      test_name: string;
      value_text: string;
      unit?: string | null;
      reference_range?: string | null;
      range_status?: string | null;
    }>;
  }>;
  sideEffectsHistory?: Array<{
    medicine_name?: string | null;
    note: string;
    severity?: string | null;
    occurred_at?: string | null;
  }>;
}

/**
 * Multi-Turn Conversational Context Resolver:
 * Resolves pronouns ("it", "this med", "the antibiotic") using recent conversation turns.
 */
export function resolveMultiTurnQuery(
  latestQuery: string,
  previousMessages: Array<{ role: string; content: string }> = []
): string {
  const q = latestQuery.trim();
  const lower = q.toLowerCase();

  // If query explicitly contains medicine names, return as is
  const hasDirectDrug = GENERIC_MOLECULE_REGISTRY.some(
    (m) =>
      lower.includes(m.genericName.toLowerCase()) ||
      m.brandAliases.some((alias) => lower.includes(alias.toLowerCase()))
  );

  if (hasDirectDrug || previousMessages.length === 0) {
    return q;
  }

  // Look for pronoun patterns
  const pronounPatterns = [
    /\b(it|this|that|this medicine|this drug|this tablet|the medicine|the pill|the antibiotic)\b/i,
  ];
  const hasPronoun = pronounPatterns.some((pattern) => pattern.test(lower));

  if (!hasPronoun) {
    return q;
  }

  // Scan backwards through previous assistant and user messages to find the most recently mentioned drug
  for (let i = previousMessages.length - 1; i >= 0; i--) {
    const msg = previousMessages[i];
    if (!msg || !msg.content) continue;
    const prevContent = msg.content.toLowerCase();
    for (const mol of GENERIC_MOLECULE_REGISTRY) {
      if (prevContent.includes(mol.genericName.toLowerCase())) {
        return `${q} (referring to ${mol.genericName})`;
      }
      for (const alias of mol.brandAliases) {
        if (prevContent.includes(alias.toLowerCase())) {
          return `${q} (referring to ${alias} / ${mol.genericName})`;
        }
      }
    }
  }

  return q;
}

/**
 * Executes hybrid semantic + clinical rule retrieval + safety sentinel analysis.
 */
export function executeClinicalRag(
  query: string,
  patientContext?: PatientContextInput,
  previousMessages: Array<{ role: string; content: string }> = []
): RagRetrievalResult {
  // 1. Resolve Multi-Turn Context
  const resolvedContextQuery = resolveMultiTurnQuery(query, previousMessages);
  const qLower = resolvedContextQuery.toLowerCase();

  const retrievedClinicalRules: string[] = [];
  const retrievedPatientEvidence: string[] = [];
  const citations: RetrievedCitation[] = [];

  // 2. Run Duplicate Drug & Cumulative Overdose Sentinel
  const sentinel = analyzeSafetySentinel(patientContext?.activeMedicines || [], resolvedContextQuery);
  const sentinelAlerts = sentinel.alerts;

  if (sentinel.alertPromptDirectives.length > 0) {
    retrievedClinicalRules.push(...sentinel.alertPromptDirectives);
  }

  sentinelAlerts.forEach((alert) => {
    citations.push({
      source: `Clinical Safety Sentinel: ${alert.genericName}`,
      type: 'safety_sentinel',
      detail: alert.clinicalMessage,
    });
  });

  // 3. Run Longitudinal Biomarker Trajectory & Predictive Trend Engine
  const { trajectories, trajectoryPromptDirectives } = analyzeBiomarkerTrajectories(
    patientContext?.recentReports || []
  );

  if (trajectoryPromptDirectives.length > 0) {
    retrievedClinicalRules.push(...trajectoryPromptDirectives);
  }

  trajectories.forEach((traj) => {
    if (traj.predictiveAlert || traj.trendStatus === 'worsening' || traj.trendStatus === 'improving') {
      citations.push({
        source: `Biomarker Trajectory: ${traj.displayName}`,
        type: 'biomarker_trajectory',
        detail: traj.clinicalSignificance,
      });
    }
  });

  // 4. Detect Query Intent
  let queryIntent: RagRetrievalResult['queryIntent'] = 'general_clinical';
  if (sentinelAlerts.length > 0) {
    queryIntent = 'overdose_sentinel';
  } else if (
    qLower.includes('interact') ||
    qLower.includes('safe to take') ||
    qLower.includes('together') ||
    qLower.includes('combination')
  ) {
    queryIntent = 'interaction_check';
  } else if (
    qLower.includes('lab') ||
    qLower.includes('test') ||
    qLower.includes('report') ||
    qLower.includes('hba1c') ||
    qLower.includes('sugar') ||
    qLower.includes('cholesterol') ||
    qLower.includes('creatinine') ||
    qLower.includes('sgpt') ||
    qLower.includes('alt') ||
    qLower.includes('potassium') ||
    qLower.includes('blood')
  ) {
    queryIntent = 'lab_interpretation';
  } else if (
    qLower.includes('when') ||
    qLower.includes('time') ||
    qLower.includes('food') ||
    qLower.includes('empty stomach') ||
    qLower.includes('meal') ||
    qLower.includes('schedule') ||
    qLower.includes('missed') ||
    qLower.includes('forgot')
  ) {
    queryIntent = 'dosing_timing';
  } else if (
    qLower.includes('pregnant') ||
    qLower.includes('pregnancy') ||
    qLower.includes('breastfeed') ||
    qLower.includes('lactation') ||
    qLower.includes('baby')
  ) {
    queryIntent = 'pregnancy_lactation';
  } else if (
    qLower.includes('surgery') ||
    qLower.includes('operation') ||
    qLower.includes('dental') ||
    qLower.includes('extraction') ||
    qLower.includes('pre-op') ||
    qLower.includes('stop before')
  ) {
    queryIntent = 'pre_op';
  }

  // 4. Retrieve Matching Drug Monographs from Pharmacopeia
  const activeMedNames = (patientContext?.activeMedicines || []).map((m) => m.medicine_name.toLowerCase());

  const relevantDrugs = DRUG_KNOWLEDGE_CORPUS.filter((drug) => {
    const isDirectlyQueried =
      qLower.includes(drug.genericName.toLowerCase()) ||
      drug.brandAliases.some((alias) => qLower.includes(alias.toLowerCase()));

    const isPatientActiveMed = activeMedNames.some(
      (pMed) =>
        pMed.includes(drug.genericName.toLowerCase()) ||
        drug.brandAliases.some((alias) => pMed.includes(alias.toLowerCase()))
    );

    return isDirectlyQueried || isPatientActiveMed;
  });

  relevantDrugs.forEach((drug) => {
    // Food & timing rules
    retrievedClinicalRules.push(
      `[Pharmacopeia: ${drug.genericName}] Class: ${drug.drugClass}. Food Rule: ${drug.foodRules.instructions} Key Food Warning: ${drug.foodRules.foodInteractions.join(' ')}`
    );

    // Drug Interactions
    drug.keyInteractions.forEach((inter) => {
      retrievedClinicalRules.push(
        `[Interaction Rule: ${drug.genericName} + ${inter.targetDrugOrClass}] (${inter.severity.toUpperCase()}): ${inter.mechanism}. Advice: ${inter.clinicalAdvice}`
      );
    });

    if (queryIntent === 'pregnancy_lactation') {
      retrievedClinicalRules.push(
        `[Pregnancy & Lactation: ${drug.genericName}] FDA Risk: ${drug.pregnancyRisk}, Lactation: ${drug.lactationSafety}.`
      );
    }

    if (queryIntent === 'pre_op' && drug.preOpCessationDays !== undefined) {
      retrievedClinicalRules.push(
        `[Surgical Pre-Op: ${drug.genericName}] Recommended cessation: ${drug.preOpCessationDays} days prior to elective surgery/dental procedures.`
      );
    }

    citations.push({
      source: `BNF / FDA Monograph: ${drug.genericName}`,
      type: 'clinical_guideline',
      detail: `Class: ${drug.drugClass}; Food: ${drug.foodRules.rule}`,
    });
  });

  // 5. Retrieve Matching Biomarkers & Reference Ranges
  BIOMARKER_KNOWLEDGE_CORPUS.forEach((bio) => {
    const isRelevantBio =
      qLower.includes(bio.name.toLowerCase()) ||
      bio.aliases.some((alias) => qLower.includes(alias.toLowerCase())) ||
      queryIntent === 'lab_interpretation';

    if (isRelevantBio) {
      retrievedClinicalRules.push(
        `[Diagnostic Reference: ${bio.name}] Standard Range: ${bio.standardReferenceRange}. High Interpretation: ${bio.elevatedInterpretation}. Decreased: ${bio.decreasedInterpretation}`
      );
      citations.push({
        source: `Diagnostic Range: ${bio.name}`,
        type: 'clinical_guideline',
        detail: `Reference: ${bio.standardReferenceRange}`,
      });
    }
  });

  // 6. Retrieve Grounded Patient Records Evidence
  if (patientContext?.activeMedicines && patientContext.activeMedicines.length > 0) {
    patientContext.activeMedicines.forEach((m) => {
      retrievedPatientEvidence.push(
        `[Active Prescription] ${m.medicine_name} ${m.strength || ''} | Routine: ${m.frequency_code || 'Unspecified'} | Meal: ${m.with_food === true ? 'After meals' : m.with_food === false ? 'Empty stomach' : 'Anytime'}`
      );
      citations.push({
        source: `Prescribed: ${m.medicine_name} ${m.strength || ''}`,
        type: 'patient_prescription',
        detail: `Routine: ${m.frequency_code || 'OD'}`,
      });
    });
  }

  if (patientContext?.recentReports && patientContext.recentReports.length > 0) {
    patientContext.recentReports.forEach((rep) => {
      rep.results.forEach((res) => {
        retrievedPatientEvidence.push(
          `[Patient Lab Report: ${rep.title} (${rep.report_date})] ${res.test_name} = ${res.value_text} ${res.unit || ''} (Reference: ${res.reference_range || 'N/A'}, Status: ${res.range_status || 'Normal'})`
        );
        citations.push({
          source: `Lab: ${rep.title} (${rep.report_date})`,
          type: 'patient_lab_result',
          detail: `${res.test_name}: ${res.value_text} ${res.unit || ''}`,
        });
      });
    });
  }

  if (patientContext?.recentVisits && patientContext.recentVisits.length > 0) {
    patientContext.recentVisits.forEach((v) => {
      retrievedPatientEvidence.push(
        `[Doctor Consultation: Dr. ${v.doctor_name || 'Physician'} on ${v.visit_date}] Diagnosis: ${v.diagnosis || 'General'}. Advice: ${v.doctor_advice || 'Follow prescription'}`
      );
      citations.push({
        source: `Consultation: Dr. ${v.doctor_name || 'Physician'} (${v.visit_date})`,
        type: 'patient_consultation',
        detail: v.diagnosis || 'Checkup',
      });
    });
  }

  if (patientContext?.sideEffectsHistory && patientContext.sideEffectsHistory.length > 0) {
    patientContext.sideEffectsHistory.forEach((s) => {
      retrievedPatientEvidence.push(
        `[Reported Adverse Reaction (${s.occurred_at || 'Recent'})] ${s.note} ${s.medicine_name ? `(Suspected Drug: ${s.medicine_name})` : ''} Severity: ${s.severity || 'Moderate'}`
      );
    });
  }

  const uniqueCitations = Array.from(
    new Map(citations.map((c) => [c.source, c])).values()
  ).slice(0, 6);

  return {
    retrievedClinicalRules: retrievedClinicalRules.slice(0, 12),
    retrievedPatientEvidence: retrievedPatientEvidence.slice(0, 14),
    citations: uniqueCitations,
    sentinelAlerts,
    biomarkerTrajectories: trajectories,
    queryIntent,
    resolvedContextQuery,
  };
}

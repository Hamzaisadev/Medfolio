import {
  DRUG_KNOWLEDGE_CORPUS,
  BIOMARKER_KNOWLEDGE_CORPUS,
} from './clinicalKnowledge';

export interface RetrievedCitation {
  source: string;
  type: 'clinical_guideline' | 'patient_prescription' | 'patient_lab_result' | 'patient_consultation';
  detail: string;
}

export interface RagRetrievalResult {
  retrievedClinicalRules: string[];
  retrievedPatientEvidence: string[];
  citations: RetrievedCitation[];
  queryIntent: 'interaction_check' | 'lab_interpretation' | 'dosing_timing' | 'pregnancy_lactation' | 'pre_op' | 'general_clinical';
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
 * Executes hybrid semantic + clinical rule retrieval for a user query.
 */
export function executeClinicalRag(
  query: string,
  patientContext?: PatientContextInput
): RagRetrievalResult {
  const qLower = query.toLowerCase();
  const retrievedClinicalRules: string[] = [];
  const retrievedPatientEvidence: string[] = [];
  const citations: RetrievedCitation[] = [];

  // 1. Detect Query Intent
  let queryIntent: RagRetrievalResult['queryIntent'] = 'general_clinical';
  if (qLower.includes('interact') || qLower.includes('safe to take') || qLower.includes('together') || qLower.includes('combination')) {
    queryIntent = 'interaction_check';
  } else if (qLower.includes('lab') || qLower.includes('test') || qLower.includes('report') || qLower.includes('hba1c') || qLower.includes('sugar') || qLower.includes('cholesterol') || qLower.includes('creatinine') || qLower.includes('sgpt') || qLower.includes('alt') || qLower.includes('blood')) {
    queryIntent = 'lab_interpretation';
  } else if (qLower.includes('when') || qLower.includes('time') || qLower.includes('food') || qLower.includes('empty stomach') || qLower.includes('meal') || qLower.includes('schedule') || qLower.includes('missed') || qLower.includes('forgot')) {
    queryIntent = 'dosing_timing';
  } else if (qLower.includes('pregnant') || qLower.includes('pregnancy') || qLower.includes('breastfeed') || qLower.includes('lactation') || qLower.includes('baby')) {
    queryIntent = 'pregnancy_lactation';
  } else if (qLower.includes('surgery') || qLower.includes('operation') || qLower.includes('dental') || qLower.includes('extraction') || qLower.includes('pre-op') || qLower.includes('stop before')) {
    queryIntent = 'pre_op';
  }

  // 2. Retrieve Matching Drug Monographs from Pharmacopeia
  const activeMedNames = (patientContext?.activeMedicines || []).map((m) => m.medicine_name.toLowerCase());
  
  const relevantDrugs = DRUG_KNOWLEDGE_CORPUS.filter((drug) => {
    const isDirectlyQueried =
      qLower.includes(drug.genericName.toLowerCase()) ||
      drug.brandAliases.some((alias) => qLower.includes(alias.toLowerCase()));
    
    const isPatientActiveMed =
      activeMedNames.some((pMed) =>
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
      source: `BNF / FDA Drug Monograph: ${drug.genericName}`,
      type: 'clinical_guideline',
      detail: `Class: ${drug.drugClass}; Food: ${drug.foodRules.rule}`,
    });
  });

  // 3. Retrieve Matching Biomarkers & Reference Ranges
  BIOMARKER_KNOWLEDGE_CORPUS.forEach((bio) => {
    const isRelevantBio =
      qLower.includes(bio.name.toLowerCase()) ||
      bio.aliases.some((alias) => qLower.includes(alias.toLowerCase())) ||
      (queryIntent === 'lab_interpretation');

    if (isRelevantBio) {
      retrievedClinicalRules.push(
        `[Diagnostic Reference: ${bio.name}] Standard Range: ${bio.standardReferenceRange}. High Interpretation: ${bio.elevatedInterpretation}. Decreased: ${bio.decreasedInterpretation}`
      );
      citations.push({
        source: `Clinical Diagnostic Range: ${bio.name}`,
        type: 'clinical_guideline',
        detail: `Standard Reference: ${bio.standardReferenceRange}`,
      });
    }
  });

  // 4. Retrieve Grounded Patient Records Evidence
  // Active Medicines Evidence
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

  // Lab Reports Evidence
  if (patientContext?.recentReports && patientContext.recentReports.length > 0) {
    patientContext.recentReports.forEach((rep) => {
      rep.results.forEach((res) => {
        retrievedPatientEvidence.push(
          `[Patient Lab Report: ${rep.title} (${rep.report_date})] ${res.test_name} = ${res.value_text} ${res.unit || ''} (Reference: ${res.reference_range || 'N/A'}, Status: ${res.range_status || 'Normal'})`
        );
        citations.push({
          source: `Lab Report: ${rep.title} (${rep.report_date})`,
          type: 'patient_lab_result',
          detail: `${res.test_name}: ${res.value_text} ${res.unit || ''}`,
        });
      });
    });
  }

  // Consultations & Doctor Advice Evidence
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

  // Side Effects Evidence
  if (patientContext?.sideEffectsHistory && patientContext.sideEffectsHistory.length > 0) {
    patientContext.sideEffectsHistory.forEach((s) => {
      retrievedPatientEvidence.push(
        `[Reported Adverse Reaction (${s.occurred_at || 'Recent'})] ${s.note} ${s.medicine_name ? `(Suspected Drug: ${s.medicine_name})` : ''} Severity: ${s.severity || 'Moderate'}`
      );
    });
  }

  // Limit total citations to top 6 distinct items
  const uniqueCitations = Array.from(
    new Map(citations.map((c) => [c.source, c])).values()
  ).slice(0, 6);

  return {
    retrievedClinicalRules: retrievedClinicalRules.slice(0, 8),
    retrievedPatientEvidence: retrievedPatientEvidence.slice(0, 10),
    citations: uniqueCitations,
    queryIntent,
  };
}

/**
 * Curated Clinical Pharmacology & Diagnostic Biomarker Knowledge Corpus for Medfolio RAG.
 * Grounded in BNF, WHO, FDA guidelines, and regional clinical practice.
 */

export interface DrugMonograph {
  genericName: string;
  brandAliases: string[];
  drugClass: string;
  commonIndications: string[];
  foodRules: {
    rule: 'with_food' | 'empty_stomach' | 'anytime' | 'specific_timing';
    instructions: string;
    foodInteractions: string[];
  };
  keyInteractions: Array<{
    targetDrugOrClass: string;
    severity: 'critical' | 'moderate' | 'minor';
    mechanism: string;
    clinicalAdvice: string;
  }>;
  pregnancyRisk: 'Category A' | 'Category B' | 'Category C' | 'Category D' | 'Category X';
  lactationSafety: 'L1 - Safest' | 'L2 - Safer' | 'L3 - Moderately Safe' | 'L4 - Hazardous' | 'L5 - Contraindicated';
  preOpCessationDays?: number;
}

export interface BiomarkerMonograph {
  name: string;
  aliases: string[];
  category: 'Metabolic / Glycemic' | 'Lipid Panel' | 'Hepatic / Liver' | 'Renal / Kidney' | 'Hematology' | 'Thyroid' | 'Cardiac';
  standardReferenceRange: string;
  unit: string;
  elevatedInterpretation: string;
  decreasedInterpretation: string;
  drugCorrelates: string[];
}

export const DRUG_KNOWLEDGE_CORPUS: DrugMonograph[] = [
  {
    genericName: 'Atorvastatin',
    brandAliases: ['Lipiget', 'Lipitor', 'Atorva', 'Atocor'],
    drugClass: 'HMG-CoA Reductase Inhibitor (Statin)',
    commonIndications: ['Hyperlipidemia', 'Cardiovascular Risk Reduction', 'Atherosclerosis'],
    foodRules: {
      rule: 'anytime',
      instructions: 'Can be taken with or without food. Best taken at night for optimal liver synthesis.',
      foodInteractions: ['Grapefruit / Grapefruit juice increases blood concentration significantly (CYP3A4 inhibition), raising rhabdomyolysis risk.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'Clarithromycin / Erythromycin (Macrolide Antibiotics)',
        severity: 'critical',
        mechanism: 'Potent CYP3A4 inhibition dramatically raises statin serum levels.',
        clinicalAdvice: 'Temporarily hold Atorvastatin during macrolide antibiotic course or switch to Azithromycin.'
      },
      {
        targetDrugOrClass: 'Gemfibrozil / Fenofibrate',
        severity: 'moderate',
        mechanism: 'Synergistic muscle toxicity.',
        clinicalAdvice: 'Monitor for unexplained muscle pain, tenderness, or dark urine.'
      }
    ],
    pregnancyRisk: 'Category X',
    lactationSafety: 'L5 - Contraindicated',
    preOpCessationDays: 0,
  },
  {
    genericName: 'Metformin',
    brandAliases: ['Glucophage', 'Neodipar', 'Metfor'],
    drugClass: 'Biguanide Antidiabetic',
    commonIndications: ['Type 2 Diabetes Mellitus', 'PCOS', 'Insulin Resistance'],
    foodRules: {
      rule: 'with_food',
      instructions: 'Must be taken with or immediately after meals to reduce GI irritation and nausea.',
      foodInteractions: ['Excessive alcohol consumption increases risk of lactic acidosis.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'Iodinated Radiocontrast Media (CT Scans)',
        severity: 'critical',
        mechanism: 'Contrast-induced nephropathy can lead to toxic accumulation of metformin and fatal lactic acidosis.',
        clinicalAdvice: 'Withhold Metformin 48 hours prior to and 48 hours after intravenous contrast imaging.'
      }
    ],
    pregnancyRisk: 'Category B',
    lactationSafety: 'L1 - Safest',
    preOpCessationDays: 1,
  },
  {
    genericName: 'Aspirin (Acetylsalicylic Acid)',
    brandAliases: ['Disprin', 'Loprin', 'Ascard', 'Ecoprin'],
    drugClass: 'Antiplatelet / Salicylate NSAID',
    commonIndications: ['Cardioprotection', 'Stroke Prevention', 'Anti-thrombotic'],
    foodRules: {
      rule: 'with_food',
      instructions: 'Take with food or large glass of water to protect gastric mucosa.',
      foodInteractions: ['Alcohol significantly increases the risk of gastrointestinal bleeding.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'Ibuprofen / Naproxen / Diclofenac (NSAIDs)',
        severity: 'critical',
        mechanism: 'NSAIDs block antiplatelet binding of aspirin and exponentially increase peptic ulcer perforation risk.',
        clinicalAdvice: 'Avoid concomitant NSAIDs; if needed for analgesia, use Paracetamol instead.'
      },
      {
        targetDrugOrClass: 'Warfarin / Rivaroxaban / Apixaban (Anticoagulants)',
        severity: 'critical',
        mechanism: 'Compounded antihemostatic action causes high major bleed risk.',
        clinicalAdvice: 'Requires strict physician oversight and INR / anti-Xa monitoring.'
      }
    ],
    pregnancyRisk: 'Category D',
    lactationSafety: 'L3 - Moderately Safe',
    preOpCessationDays: 7,
  },
  {
    genericName: 'Omeprazole / Esomeprazole',
    brandAliases: ['Risek', 'Nexum', 'Omega', 'Losec', 'Eziday'],
    drugClass: 'Proton Pump Inhibitor (PPI)',
    commonIndications: ['GERD', 'Peptic Ulcer Disease', 'Gastric Protection'],
    foodRules: {
      rule: 'empty_stomach',
      instructions: 'Take 30 to 60 minutes before morning breakfast with water for optimal proton pump inhibition.',
      foodInteractions: ['Absorption is delayed and reduced when taken with or after meals.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'Clopidogrel (Plavix)',
        severity: 'moderate',
        mechanism: 'Omeprazole inhibits CYP2C19, reducing activation of Clopidogrel and its antiplatelet efficacy.',
        clinicalAdvice: 'Prefer Pantoprazole or Dexlansoprazole which have negligible CYP2C19 interaction.'
      }
    ],
    pregnancyRisk: 'Category C',
    lactationSafety: 'L2 - Safer',
  },
  {
    genericName: 'Amoxicillin + Clavulanic Acid',
    brandAliases: ['Augmentin', 'Curam', 'Amoclav', 'Klavox'],
    drugClass: 'Beta-lactam Antibiotic + Beta-lactamase Inhibitor',
    commonIndications: ['Bacterial Sinusitis', 'RTI', 'UTI', 'Skin & Soft Tissue Infection'],
    foodRules: {
      rule: 'with_food',
      instructions: 'Take at the start of a meal to enhance absorption of clavulanate and minimize gastrointestinal upset.',
      foodInteractions: ['Probiotic supplementation should be spaced 2 hours away from antibiotic dose.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'Methotrexate',
        severity: 'critical',
        mechanism: 'Penicillins reduce renal clearance of methotrexate, leading to toxic myelosuppression.',
        clinicalAdvice: 'Co-administration requires close hematological monitoring.'
      }
    ],
    pregnancyRisk: 'Category B',
    lactationSafety: 'L1 - Safest',
  },
  {
    genericName: 'Levothyroxine',
    brandAliases: ['Thyroxine', 'Eltroxin', 'Synthroid'],
    drugClass: 'Thyroid Hormone Replacement',
    commonIndications: ['Hypothyroidism', 'Hashimoto Thyroiditis'],
    foodRules: {
      rule: 'empty_stomach',
      instructions: 'Must be taken first thing in the morning with a full glass of plain water, at least 30-60 minutes before breakfast, tea, or coffee.',
      foodInteractions: ['Calcium, iron supplements, soy, and dietary fiber severely block absorption. Space at least 4 hours apart.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'Calcium Carbonate / Ferrous Sulfate (Iron)',
        severity: 'moderate',
        mechanism: 'Chelation in gut prevents levothyroxine absorption.',
        clinicalAdvice: 'Administer iron and calcium supplements at least 4 hours after morning levothyroxine.'
      }
    ],
    pregnancyRisk: 'Category A',
    lactationSafety: 'L1 - Safest',
  },
  {
    genericName: 'Amlodipine',
    brandAliases: ['Norvasc', 'Amlo', 'Amcard', 'Lodipin'],
    drugClass: 'Dihydropyridine Calcium Channel Blocker',
    commonIndications: ['Hypertension', 'Chronic Stable Angina'],
    foodRules: {
      rule: 'anytime',
      instructions: 'Can be taken with or without meals at a consistent time every day.',
      foodInteractions: ['Grapefruit juice can moderately increase amlodipine bioavailability, potentially causing sudden hypotension.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'Simvastatin',
        severity: 'moderate',
        mechanism: 'Amlodipine increases simvastatin exposure.',
        clinicalAdvice: 'Limit Simvastatin dose to a maximum of 20mg daily when taking with Amlodipine.'
      }
    ],
    pregnancyRisk: 'Category C',
    lactationSafety: 'L2 - Safer',
  },
  {
    genericName: 'Paracetamol (Acetaminophen)',
    brandAliases: ['Panadol', 'Calpol', 'Disprol', 'Febrol'],
    drugClass: 'Analgesic & Antipyretic',
    commonIndications: ['Fever', 'Mild to Moderate Pain', 'Headache'],
    foodRules: {
      rule: 'anytime',
      instructions: 'May be taken with or without food. Maximum safe adult dose is 4000mg (4 grams) per 24 hours.',
      foodInteractions: ['Avoid chronic alcohol consumption due to heightened risk of hepatotoxicity.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'Other Paracetamol-containing combination remedies (e.g. cold/flu syrups)',
        severity: 'critical',
        mechanism: 'Cumulative dose leading to acute liver failure.',
        clinicalAdvice: 'Check all OTC cold syrups to ensure total 24h paracetamol does not exceed 4g.'
      }
    ],
    pregnancyRisk: 'Category B',
    lactationSafety: 'L1 - Safest',
  }
];

export const BIOMARKER_KNOWLEDGE_CORPUS: BiomarkerMonograph[] = [
  {
    name: 'HbA1c (Glycated Hemoglobin)',
    aliases: ['A1c', 'Glycosylated Hemoglobin', 'Average Blood Sugar'],
    category: 'Metabolic / Glycemic',
    standardReferenceRange: '< 5.7% (Normal), 5.7 - 6.4% (Prediabetes), >= 6.5% (Diabetes)',
    unit: '%',
    elevatedInterpretation: 'Reflects chronic hyperglycemia over preceding 8-12 weeks. Elevated cardiovascular and microvascular complication risk.',
    decreasedInterpretation: 'May occur in hemolytic anemia, recent blood transfusion, or chronic renal disease.',
    drugCorrelates: ['Metformin', 'Empagliflozin', 'Sitagliptin', 'Insulin', 'Glimepiride']
  },
  {
    name: 'Fasting Blood Glucose (FBS)',
    aliases: ['Fasting Sugar', 'Fasting Plasma Glucose', 'BSR Fasting'],
    category: 'Metabolic / Glycemic',
    standardReferenceRange: '70 - 99 mg/dL (Normal), 100 - 125 mg/dL (Impaired), >= 126 mg/dL (Diabetic threshold)',
    unit: 'mg/dL',
    elevatedInterpretation: 'Acute glycemic elevation. Needs clinical correlation with HbA1c and dietary intake.',
    decreasedInterpretation: 'Hypoglycemia (< 70 mg/dL). Symptoms: shakiness, sweating, palpitations. Requires rapid glucose intake (Rule of 15).',
    drugCorrelates: ['Sulfonylureas (Amaryl)', 'Insulin', 'Metformin']
  },
  {
    name: 'Serum Creatinine',
    aliases: ['Creatinine', 'S. Creat', 'Cr'],
    category: 'Renal / Kidney',
    standardReferenceRange: '0.6 - 1.2 mg/dL (Males), 0.5 - 1.1 mg/dL (Females)',
    unit: 'mg/dL',
    elevatedInterpretation: 'Indicates reduced Glomerular Filtration Rate (GFR), acute kidney injury (AKI), or chronic kidney disease (CKD). Requires dose adjustments for renally cleared medications.',
    decreasedInterpretation: 'Low muscle mass, severe malnutrition, or pregnancy.',
    drugCorrelates: ['Metformin (renal cutoff)', 'NSAIDs (nephrotoxic)', 'ACE Inhibitors', 'Gentamicin']
  },
  {
    name: 'Alanine Aminotransferase (ALT / SGPT)',
    aliases: ['SGPT', 'ALT', 'Liver Enzyme'],
    category: 'Hepatic / Liver',
    standardReferenceRange: '7 - 56 U/L',
    unit: 'U/L',
    elevatedInterpretation: 'Marker of hepatocellular inflammation or injury. Can be triggered by fatty liver (NAFLD), hepatitis, or drug-induced liver injury.',
    decreasedInterpretation: 'Typically non-pathological.',
    drugCorrelates: ['Statins (Atorvastatin)', 'Paracetamol toxicity', 'Anti-tuberculosis drugs (Rifampin/Isoniazid)']
  },
  {
    name: 'Low-Density Lipoprotein (LDL-C)',
    aliases: ['LDL', 'Bad Cholesterol', 'LDL Cholesterol'],
    category: 'Lipid Panel',
    standardReferenceRange: '< 100 mg/dL (Optimal), < 70 mg/dL (Target for high cardiovascular risk patients)',
    unit: 'mg/dL',
    elevatedInterpretation: 'Major atherogenic driver for coronary artery disease, stroke, and peripheral arterial disease.',
    decreasedInterpretation: 'Severe hepatic disease, hyperthyroidism, or hypocholesterolemia.',
    drugCorrelates: ['Atorvastatin', 'Rosuvastatin', 'Ezetimibe']
  },
  {
    name: 'Thyroid Stimulating Hormone (TSH)',
    aliases: ['TSH', 'Thyrotropin'],
    category: 'Thyroid',
    standardReferenceRange: '0.4 - 4.0 mIU/L',
    unit: 'mIU/L',
    elevatedInterpretation: 'Primary Hypothyroidism. The pituitary secretes excess TSH to stimulate an underactive thyroid.',
    decreasedInterpretation: 'Hyperthyroidism or excessive exogenous Levothyroxine replacement.',
    drugCorrelates: ['Levothyroxine', 'Carbimazole', 'Amiodarone']
  }
];

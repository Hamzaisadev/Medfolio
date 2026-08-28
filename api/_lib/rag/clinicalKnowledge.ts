/**
 * Curated Clinical Pharmacology, Generic Molecule Registry & Diagnostic Biomarker Knowledge Corpus for Medfolio RAG.
 * Grounded in BNF, WHO, FDA, and international clinical guidelines.
 */

export interface GenericMoleculeInfo {
  genericName: string;
  drugClass: string;
  brandAliases: string[];
  maxDailyDoseMg?: number;
  unit: string;
  toxicityRisk: string;
  isNsaid?: boolean;
  isPpi?: boolean;
  isAceiOrArb?: boolean;
  isStatin?: boolean;
  isAntidiabetic?: boolean;
  isAnticoagulantOrAntiplatelet?: boolean;
}

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
  category: 'Metabolic / Glycemic' | 'Lipid Panel' | 'Hepatic / Liver' | 'Renal / Kidney' | 'Hematology' | 'Thyroid' | 'Cardiac' | 'Electrolytes';
  standardReferenceRange: string;
  unit: string;
  elevatedInterpretation: string;
  decreasedInterpretation: string;
  drugCorrelates: string[];
}

/**
 * Generic Molecule Registry for Duplicate Detection & Cumulative Overdose Sentinel
 */
export const GENERIC_MOLECULE_REGISTRY: GenericMoleculeInfo[] = [
  // Analgesics & Antipyretics
  {
    genericName: 'Paracetamol (Acetaminophen)',
    drugClass: 'Analgesic & Antipyretic',
    brandAliases: ['Panadol', 'Calpol', 'Febrol', 'Disprol', 'Tylenol', 'Paracetamol', 'Fevridol', 'Panadol Extra', 'Panadol CF', 'Panadol Night', 'Askprol'],
    maxDailyDoseMg: 4000,
    unit: 'mg',
    toxicityRisk: 'Acute hepatic necrosis (fatal liver failure). Cumulative daily dose across all paracetamol-containing combination remedies and cough/cold syrups must NEVER exceed 4000mg in 24 hours.',
  },
  // NSAIDs
  {
    genericName: 'Ibuprofen',
    drugClass: 'Non-Steroidal Anti-Inflammatory Drug (NSAID)',
    brandAliases: ['Brufen', 'Advil', 'Motrin', 'Ibuprofen', 'Nurofen', 'Profen'],
    maxDailyDoseMg: 2400,
    unit: 'mg',
    toxicityRisk: 'Gastrointestinal ulceration/perforation, acute kidney injury (AKI), fluid retention, and heightened cardiovascular risk.',
    isNsaid: true,
  },
  {
    genericName: 'Diclofenac Sodium / Potassium',
    drugClass: 'Non-Steroidal Anti-Inflammatory Drug (NSAID)',
    brandAliases: ['Voltral', 'Caflam', 'Dicloran', 'Ultrafen', 'Voveran', 'Cataflam', 'Diclofenac', 'Diclogesic', 'Airtal', 'Xflam'],
    maxDailyDoseMg: 150,
    unit: 'mg',
    toxicityRisk: 'High risk of peptic ulcer hemorrhage, hepatic transaminase elevations, renal impairment, and major thrombotic cardiovascular events.',
    isNsaid: true,
  },
  {
    genericName: 'Naproxen',
    drugClass: 'Non-Steroidal Anti-Inflammatory Drug (NSAID)',
    brandAliases: ['Synflex', 'Naprosyn', 'Aleve', 'Naproxen', 'Naxen'],
    maxDailyDoseMg: 1000,
    unit: 'mg',
    toxicityRisk: 'Gastric erosion, renal papillary necrosis, bleeding risk, and fluid retention.',
    isNsaid: true,
  },
  {
    genericName: 'Mefenamic Acid',
    drugClass: 'Non-Steroidal Anti-Inflammatory Drug (NSAID)',
    brandAliases: ['Ponstan', 'Ponstel', 'Mefenamic Acid', 'Dolfenal', 'Meftal'],
    maxDailyDoseMg: 1500,
    unit: 'mg',
    toxicityRisk: 'Severe gastrointestinal ulceration, autoimmune hemolytic anemia, and nephrotoxicity with prolonged use.',
    isNsaid: true,
  },
  {
    genericName: 'Celecoxib',
    drugClass: 'COX-2 Selective NSAID',
    brandAliases: ['Celebrex', 'Celbex', 'Cobix', 'Celcox'],
    maxDailyDoseMg: 400,
    unit: 'mg',
    toxicityRisk: 'Thromboembolic cardiovascular events (myocardial infarction/stroke) and renal failure.',
    isNsaid: true,
  },
  // Antiplatelets & Anticoagulants
  {
    genericName: 'Aspirin (Acetylsalicylic Acid)',
    drugClass: 'Antiplatelet / Salicylate',
    brandAliases: ['Disprin', 'Loprin', 'Ascard', 'Ecoprin', 'Bayer Aspirin', 'Solprin'],
    maxDailyDoseMg: 150, // Cardioprotective maintenance ceiling
    unit: 'mg',
    toxicityRisk: 'Major gastrointestinal bleed, intracranial hemorrhage, and salicylate-induced gastric ulceration.',
    isAnticoagulantOrAntiplatelet: true,
  },
  {
    genericName: 'Clopidogrel',
    drugClass: 'P2Y12 Platelet Inhibitor',
    brandAliases: ['Plavix', 'Lowplat', 'Noclot', 'Clopilet', 'Ceruvin'],
    maxDailyDoseMg: 75,
    unit: 'mg',
    toxicityRisk: 'Severe bleeding diathesis, hematoma, and thrombotic thrombocytopenic purpura (TTP).',
    isAnticoagulantOrAntiplatelet: true,
  },
  {
    genericName: 'Rivaroxaban',
    drugClass: 'Direct Oral Anticoagulant (DOAC / Factor Xa Inhibitor)',
    brandAliases: ['Xarelto', 'Rivo', 'Rivarox', 'Rivaroxaban'],
    maxDailyDoseMg: 20,
    unit: 'mg',
    toxicityRisk: 'Major spontaneous hemorrhage. Strict avoidance of concurrent NSAIDs or unmonitored antiplatelet drugs.',
    isAnticoagulantOrAntiplatelet: true,
  },
  // Proton Pump Inhibitors (PPIs)
  {
    genericName: 'Omeprazole',
    drugClass: 'Proton Pump Inhibitor (PPI)',
    brandAliases: ['Risek', 'Omega', 'Losec', 'Omep', 'Omez', 'Prilosec'],
    maxDailyDoseMg: 80,
    unit: 'mg',
    toxicityRisk: 'Hypomagnesemia, Clostridium difficile diarrhea, impaired vitamin B12 / calcium absorption, and CYP2C19 interaction.',
    isPpi: true,
  },
  {
    genericName: 'Esomeprazole',
    drugClass: 'Proton Pump Inhibitor (PPI)',
    brandAliases: ['Nexum', 'Eziday', 'Nexium', 'Esomep', 'Esobar'],
    maxDailyDoseMg: 80,
    unit: 'mg',
    toxicityRisk: 'Hypomagnesemia, increased risk of bone fractures with chronic high-dose therapy, and interstitial nephritis.',
    isPpi: true,
  },
  {
    genericName: 'Pantoprazole',
    drugClass: 'Proton Pump Inhibitor (PPI)',
    brandAliases: ['Zopent', 'Pantosec', 'Protonix', 'Pantop', 'Panto-D'],
    maxDailyDoseMg: 80,
    unit: 'mg',
    toxicityRisk: 'Subacute cutaneous lupus erythematosus, vitamin malabsorption, and long-term renal interstitial nephritis.',
    isPpi: true,
  },
  // Statins (Lipid-Lowering Agents)
  {
    genericName: 'Atorvastatin',
    drugClass: 'HMG-CoA Reductase Inhibitor (Statin)',
    brandAliases: ['Lipiget', 'Lipitor', 'Atorva', 'Atocor', 'Torvast'],
    maxDailyDoseMg: 80,
    unit: 'mg',
    toxicityRisk: 'Rhabdomyolysis (skeletal muscle breakdown leading to acute renal failure) and hepatotoxicity.',
    isStatin: true,
  },
  {
    genericName: 'Rosuvastatin',
    drugClass: 'HMG-CoA Reductase Inhibitor (Statin)',
    brandAliases: ['X-Plat', 'Rovista', 'Crestor', 'Rosuvas', 'Rosuvastatin'],
    maxDailyDoseMg: 40,
    unit: 'mg',
    toxicityRisk: 'Myopathy, rhabdomyolysis with dark tea-colored urine, and proteinuria.',
    isStatin: true,
  },
  // Antidiabetics
  {
    genericName: 'Metformin',
    drugClass: 'Biguanide Antidiabetic',
    brandAliases: ['Glucophage', 'Neodipar', 'Metfor', 'Formet', 'Glucophage XR'],
    maxDailyDoseMg: 2550,
    unit: 'mg',
    toxicityRisk: 'Lactic acidosis (especially in renal impairment, eGFR < 30 mL/min, or concomitant IV radiocontrast).',
    isAntidiabetic: true,
  },
  {
    genericName: 'Glimepiride',
    drugClass: 'Sulfonylurea Antidiabetic',
    brandAliases: ['Amaryl', 'Diaryl', 'Glem', 'Glimepiride', 'Evopride'],
    maxDailyDoseMg: 8,
    unit: 'mg',
    toxicityRisk: 'Severe, prolonged hypoglycemia (shakiness, diaphoresis, loss of consciousness).',
    isAntidiabetic: true,
  },
  {
    genericName: 'Empagliflozin',
    drugClass: 'SGLT2 Inhibitor',
    brandAliases: ['Jardiance', 'Empa', 'Glempa'],
    maxDailyDoseMg: 25,
    unit: 'mg',
    toxicityRisk: 'Euglycemic diabetic ketoacidosis (DKA), genital mycotic infections, and volume depletion/hypotension.',
    isAntidiabetic: true,
  },
  // Antihypertensives & Cardiovascular
  {
    genericName: 'Amlodipine',
    drugClass: 'Dihydropyridine Calcium Channel Blocker (CCB)',
    brandAliases: ['Norvasc', 'Amlo', 'Amcard', 'Lodipin', 'Amlopres'],
    maxDailyDoseMg: 10,
    unit: 'mg',
    toxicityRisk: 'Severe peripheral edema, reflex tachycardia, and profound hypotension.',
  },
  {
    genericName: 'Bisoprolol',
    drugClass: 'Beta-1 Selective Adrenergic Blocker',
    brandAliases: ['Concor', 'Bisocor', 'Cardicor', 'Biso'],
    maxDailyDoseMg: 20,
    unit: 'mg',
    toxicityRisk: 'Severe bradycardia (< 50 bpm), heart block, cardiogenic shock, and bronchospasm in asthmatics.',
  },
  {
    genericName: 'Valsartan / Losartan',
    drugClass: 'Angiotensin II Receptor Blocker (ARB)',
    brandAliases: ['Diovan', 'Cozaar', 'Xartan', 'Valtec', 'Losar'],
    maxDailyDoseMg: 320,
    unit: 'mg',
    toxicityRisk: 'Severe hyperkalemia, acute renal failure, and profound postural hypotension when doubled or combined with ACE inhibitors.',
    isAceiOrArb: true,
  },
  {
    genericName: 'Lisinopril / Enalapril / Ramipril',
    drugClass: 'ACE Inhibitor',
    brandAliases: ['Zestril', 'Renitec', 'Tritace', 'Enalapril', 'Cardace'],
    maxDailyDoseMg: 40,
    unit: 'mg',
    toxicityRisk: 'Life-threatening angioedema (swelling of lips/tongue/airway), acute hyperkalemia, and intractable dry cough.',
    isAceiOrArb: true,
  },
  // Thyroid
  {
    genericName: 'Levothyroxine Sodium',
    drugClass: 'Synthetic Thyroid Hormone (T4)',
    brandAliases: ['Thyroxine', 'Eltroxin', 'Synthroid', 'Levothyroxine'],
    maxDailyDoseMg: 0.3, // 300mcg
    unit: 'mg',
    toxicityRisk: 'Iatrogenic thyrotoxicosis, cardiac arrhythmias (atrial fibrillation), palpitations, and bone mineral loss.',
  },
  // Antibiotics
  {
    genericName: 'Amoxicillin + Clavulanate',
    drugClass: 'Beta-Lactam + Beta-Lactamase Inhibitor Antibiotic',
    brandAliases: ['Augmentin', 'Curam', 'Amoclav', 'Klavox', 'Clavam', 'Enhancin'],
    maxDailyDoseMg: 3000,
    unit: 'mg',
    toxicityRisk: 'Cholestatic jaundice / acute hepatitis, severe Clostridium difficile pseudomembranous colitis, and allergic anaphylaxis.',
  },
  {
    genericName: 'Ciprofloxacin',
    drugClass: 'Fluoroquinolone Antibiotic',
    brandAliases: ['Ciproxin', 'Cipro', 'Ciprobay', 'Cifran', 'Novidat'],
    maxDailyDoseMg: 1500,
    unit: 'mg',
    toxicityRisk: 'Tendon rupture (especially Achilles tendon), QT prolongation/arrhythmia, CNS toxicity/seizures, and peripheral neuropathy.',
  },
  {
    genericName: 'Azithromycin',
    drugClass: 'Macrolide Antibiotic',
    brandAliases: ['Azomax', 'Zithromax', 'Azitro', 'Macrozit', 'Azyth'],
    maxDailyDoseMg: 500,
    unit: 'mg',
    toxicityRisk: 'QT interval prolongation, Torsades de Pointes, and cholestatic hepatotoxicity.',
  }
];

export const DRUG_KNOWLEDGE_CORPUS: DrugMonograph[] = [
  {
    genericName: 'Atorvastatin',
    brandAliases: ['Lipiget', 'Lipitor', 'Atorva', 'Atocor', 'Torvast'],
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
    brandAliases: ['Glucophage', 'Neodipar', 'Metfor', 'Formet', 'Glucophage XR'],
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
    brandAliases: ['Disprin', 'Loprin', 'Ascard', 'Ecoprin', 'Bayer Aspirin', 'Solprin'],
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
    brandAliases: ['Risek', 'Nexum', 'Omega', 'Losec', 'Eziday', 'Nexium', 'Protonix', 'Zopent'],
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
    preOpCessationDays: 0,
  },
  {
    genericName: 'Amoxicillin + Clavulanic Acid',
    brandAliases: ['Augmentin', 'Curam', 'Amoclav', 'Klavox', 'Clavam'],
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
    brandAliases: ['Norvasc', 'Amlo', 'Amcard', 'Lodipin', 'Amlopres'],
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
    brandAliases: ['Panadol', 'Calpol', 'Disprol', 'Febrol', 'Tylenol', 'Panadol Extra'],
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
  },
  {
    genericName: 'Diclofenac',
    brandAliases: ['Voltral', 'Caflam', 'Dicloran', 'Ultrafen', 'Voveran', 'Cataflam'],
    drugClass: 'NSAID',
    commonIndications: ['Acute pain', 'Arthritis', 'Post-operative inflammation'],
    foodRules: {
      rule: 'with_food',
      instructions: 'Must be taken with or immediately after food to protect gastric lining.',
      foodInteractions: ['Avoid alcohol to prevent compounded gastric bleeding risk.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'ACE Inhibitors / ARBs (e.g. Lisinopril, Valsartan) + Diuretics (Triple Whammy)',
        severity: 'critical',
        mechanism: 'Simultaneous renal vasoconstriction and hypoperfusion causes Acute Kidney Injury (AKI).',
        clinicalAdvice: 'Avoid concurrent NSAID therapy in patients taking ACEi/ARB + Diuretic.'
      }
    ],
    pregnancyRisk: 'Category D',
    lactationSafety: 'L2 - Safer',
    preOpCessationDays: 3,
  },
  {
    genericName: 'Bisoprolol',
    brandAliases: ['Concor', 'Bisocor', 'Cardicor'],
    drugClass: 'Beta-1 Selective Adrenergic Blocker',
    commonIndications: ['Hypertension', 'Heart Failure', 'Angina'],
    foodRules: {
      rule: 'anytime',
      instructions: 'Take in the morning with or without food.',
      foodInteractions: ['Avoid high alcohol intake which can exaggerate orthostatic blood pressure drops.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'Verapamil / Diltiazem (Non-DHP CCBs)',
        severity: 'critical',
        mechanism: 'Profound negative inotropic and chronotropic synergism leading to complete AV block and heart failure.',
        clinicalAdvice: 'Strict contraindication for simultaneous oral administration without intensive hemodynamic monitoring.'
      }
    ],
    pregnancyRisk: 'Category C',
    lactationSafety: 'L3 - Moderately Safe',
  },
  {
    genericName: 'Ciprofloxacin',
    brandAliases: ['Ciproxin', 'Cipro', 'Ciprobay', 'Novidat'],
    drugClass: 'Fluoroquinolone Antibiotic',
    commonIndications: ['UTI', 'Gastrointestinal infections', 'Typhoid Fever'],
    foodRules: {
      rule: 'specific_timing',
      instructions: 'Take 2 hours before or 4 hours after dairy products, calcium-fortified juices, or antacids.',
      foodInteractions: ['Calcium, iron, aluminum, and magnesium chelate with ciprofloxacin, destroying antibiotic absorption.'],
    },
    keyInteractions: [
      {
        targetDrugOrClass: 'Theophylline',
        severity: 'critical',
        mechanism: 'Inhibits theophylline metabolism, causing life-threatening theophylline toxicity and seizures.',
        clinicalAdvice: 'Reduce theophylline dose and monitor plasma levels.'
      }
    ],
    pregnancyRisk: 'Category C',
    lactationSafety: 'L3 - Moderately Safe',
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
  },
  {
    name: 'Serum Potassium (K+)',
    aliases: ['Potassium', 'K+'],
    category: 'Electrolytes',
    standardReferenceRange: '3.5 - 5.0 mEq/L',
    unit: 'mEq/L',
    elevatedInterpretation: 'Hyperkalemia (> 5.2 mEq/L) carries high cardiac arrhythmia risk. Often exacerbated by ACEi, ARBs, Spironolactone, or NSAIDs.',
    decreasedInterpretation: 'Hypokalemia (< 3.5 mEq/L) can cause muscle weakness, cramps, and U-waves on ECG. Often caused by Loop or Thiazide diuretics.',
    drugCorrelates: ['ACE Inhibitors', 'ARBs', 'Spironolactone', 'Furosemide']
  }
];

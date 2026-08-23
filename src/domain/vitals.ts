// Clinical Classification Standards for Blood Pressure and Blood Glucose

export type GlucoseType = 'fasting' | 'post_prandial' | 'random' | 'bedtime';

export type GlucoseUnit = 'mg/dL' | 'mmol/L';

export type GlucoseStatus =
  | 'severe_hypoglycemia'
  | 'hypoglycemia'
  | 'normal'
  | 'elevated'
  | 'high'
  | 'crisis';

export type BpStage =
  | 'hypotension'
  | 'normal'
  | 'elevated'
  | 'stage_1'
  | 'stage_2'
  | 'hypertensive_crisis';

/**
 * How urgently a reading should be presented.
 *
 * A severity level, not a colour. These functions used to return Tailwind class
 * strings (`'text-rose-900 bg-rose-50 border-rose-300'`), which put presentation
 * in the domain layer, made the classes invisible to the theme system, and left
 * vitals stuck on light-mode colours. The UI maps a tone to classes; the domain
 * only decides how serious the reading is.
 */
export type VitalTone = 'ok' | 'warn' | 'risk' | 'critical';

export interface GlucoseReading {
  id?: string;
  user_id: string;
  profile_id: string;
  measured_at: string; // ISO date-time string
  type: GlucoseType;
  value_mg_dl: number;
  meal_context?: string;
  notes?: string;
}

export interface BloodPressureReading {
  id?: string;
  user_id: string;
  profile_id: string;
  measured_at: string; // ISO date-time string
  systolic: number;
  diastolic: number;
  pulse_bpm?: number;
  arm?: 'left' | 'right';
  posture?: 'sitting' | 'standing' | 'lying';
  notes?: string;
}

/**
 * Converts mmol/L to mg/dL (1 mmol/L = 18.0182 mg/dL)
 */
export function mmolToMgDl(mmol: number): number {
  return Math.round(mmol * 18.0182);
}

/**
 * Converts mg/dL to mmol/L
 */
export function mgDlToMmol(mgdl: number): number {
  return parseFloat((mgdl / 18.0182).toFixed(1));
}

/**
 * ADA glucose thresholds, in mg/dL.
 *
 * `crisis` exists because a reading of 600 previously reported "High Blood Sugar
 * — stay hydrated and monitor closely", which is the wrong advice for a
 * hyperglycaemic emergency.
 */
const GLUCOSE = {
  severeLow: 54, // ADA Level 2 hypoglycaemia — clinically significant
  low: 70, // ADA Level 1 hypoglycaemia
  fastingNormalMax: 99,
  fastingPreDiabeticMax: 125,
  postMealNormalMax: 140,
  postMealElevatedMax: 199,
  crisis: 300, // hyperglycaemic crisis range (DKA / HHS risk)
} as const;

const URGENT_CARE_ADVICE =
  'Seek medical care now. Very high glucose can lead to diabetic ketoacidosis — check ketones if you can, drink water, and contact your doctor or the nearest emergency department immediately.';

/**
 * Evaluates Blood Glucose according to American Diabetes Association (ADA) standards
 */
export function evaluateGlucose(valueMgDl: number, type: GlucoseType): {
  status: GlucoseStatus;
  label: string;
  tone: VitalTone;
  advice: string;
} {
  // Emergencies are checked before the per-type bands, so they cannot be missed
  // for any reading type.
  if (valueMgDl < GLUCOSE.severeLow) {
    return {
      status: 'severe_hypoglycemia',
      label: 'Severely Low (Emergency)',
      tone: 'critical',
      advice:
        'Dangerously low. Take 15–20g of fast-acting sugar immediately and have someone stay with you. If you feel confused, drowsy or cannot swallow safely, call emergency services now.',
    };
  }

  if (valueMgDl < GLUCOSE.low) {
    return {
      status: 'hypoglycemia',
      label: 'Low (Hypoglycemia)',
      tone: 'warn',
      advice:
        'Consume 15g of fast-acting carbohydrates immediately (juice, glucose tablet) and recheck in 15 minutes.',
    };
  }

  if (valueMgDl >= GLUCOSE.crisis) {
    return {
      status: 'crisis',
      label: 'Critically High (Urgent)',
      tone: 'critical',
      advice: URGENT_CARE_ADVICE,
    };
  }

  if (type === 'fasting') {
    if (valueMgDl <= GLUCOSE.fastingNormalMax) {
      return {
        status: 'normal',
        label: 'Optimal Fasting',
        tone: 'ok',
        advice: 'Normal healthy fasting blood glucose range.',
      };
    }
    if (valueMgDl <= GLUCOSE.fastingPreDiabeticMax) {
      return {
        status: 'elevated',
        label: 'Pre-diabetic Range',
        tone: 'warn',
        advice: 'Elevated fasting level. Monitor carbohydrate intake and discuss with your physician.',
      };
    }
    return {
      status: 'high',
      label: 'High (Diabetic Fasting)',
      tone: 'risk',
      advice: 'Fasting glucose is above target. Ensure prescribed medications are taken as directed.',
    };
  }

  if (type === 'post_prandial') {
    if (valueMgDl <= GLUCOSE.postMealNormalMax) {
      return {
        status: 'normal',
        label: 'Normal Post-Meal',
        tone: 'ok',
        advice: 'Post-meal glucose managed effectively within normal target.',
      };
    }
    if (valueMgDl <= GLUCOSE.postMealElevatedMax) {
      return {
        status: 'elevated',
        label: 'Elevated Post-Meal',
        tone: 'warn',
        advice: 'Post-prandial spike. Review meal composition and glycemic load.',
      };
    }
    return {
      status: 'high',
      label: 'High (Spike)',
      tone: 'risk',
      advice: 'Marked post-meal spike. Consult your physician regarding dose timing.',
    };
  }

  // General random / bedtime
  if (valueMgDl <= GLUCOSE.postMealNormalMax) {
    return {
      status: 'normal',
      label: 'Normal Blood Sugar',
      tone: 'ok',
      advice: 'Healthy glucose level.',
    };
  }
  if (valueMgDl <= GLUCOSE.postMealElevatedMax) {
    return {
      status: 'elevated',
      label: 'Elevated',
      tone: 'warn',
      advice: 'Moderately elevated reading.',
    };
  }
  return {
    status: 'high',
    label: 'High Blood Sugar',
    tone: 'risk',
    advice: 'High glucose reading. Stay hydrated and monitor closely.',
  };
}

/**
 * Calculates Mean Arterial Pressure (MAP)
 * MAP = Diastolic + (1/3 * (Systolic - Diastolic))
 */
export function calculateMap(systolic: number, diastolic: number): number {
  return Math.round(diastolic + (systolic - diastolic) / 3);
}

/**
 * Evaluates Blood Pressure according to American Heart Association (AHA) standards,
 * plus a low-BP band the AHA table itself does not cover.
 */
export function evaluateBloodPressure(systolic: number, diastolic: number): {
  stage: BpStage;
  label: string;
  tone: VitalTone;
  advice: string;
} {
  if (systolic >= 180 || diastolic >= 120) {
    return {
      stage: 'hypertensive_crisis',
      label: 'Hypertensive Crisis',
      tone: 'critical',
      advice: 'Critically high blood pressure. Rest quietly for 5 minutes and re-test. If still high or accompanied by headache/chest pain, seek emergency medical care immediately.',
    };
  }

  // Checked before the "normal" fall-through: 70/40 previously reported
  // "Optimal cardiovascular blood pressure reading".
  if (systolic < 90 || diastolic < 60) {
    return {
      stage: 'hypotension',
      label: 'Low Blood Pressure',
      tone: 'warn',
      advice:
        'Blood pressure is below the normal range. If you feel dizzy, faint, confused or unusually cold and clammy, seek medical help now. Otherwise sit or lie down, sip fluids, re-test after 5 minutes, and tell your doctor — some blood pressure medicines need adjusting.',
    };
  }

  if (systolic >= 140 || diastolic >= 90) {
    return {
      stage: 'stage_2',
      label: 'Stage 2 Hypertension',
      tone: 'risk',
      advice: 'Blood pressure is significantly elevated. Review antihypertensive medication adherence with your doctor.',
    };
  }

  if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
    return {
      stage: 'stage_1',
      label: 'Stage 1 Hypertension',
      tone: 'warn',
      advice: 'Mild hypertension. Maintain low dietary sodium and regular tracking.',
    };
  }

  if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
    return {
      stage: 'elevated',
      label: 'Elevated BP',
      tone: 'warn',
      advice: 'Systolic pressure is slightly above optimal. Focus on stress management and physical activity.',
    };
  }

  return {
    stage: 'normal',
    label: 'Normal Blood Pressure',
    tone: 'ok',
    advice: 'Optimal cardiovascular blood pressure reading.',
  };
}

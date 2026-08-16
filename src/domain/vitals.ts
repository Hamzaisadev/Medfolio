// Clinical Classification Standards for Blood Pressure and Blood Glucose

export type GlucoseType = 'fasting' | 'post_prandial' | 'random' | 'bedtime';

export type GlucoseUnit = 'mg/dL' | 'mmol/L';

export type GlucoseStatus = 'hypoglycemia' | 'normal' | 'elevated' | 'high' | 'crisis';

export type BpStage =
  | 'normal'
  | 'elevated'
  | 'stage_1'
  | 'stage_2'
  | 'hypertensive_crisis';

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
 * Evaluates Blood Glucose according to American Diabetes Association (ADA) standards
 */
export function evaluateGlucose(valueMgDl: number, type: GlucoseType): {
  status: GlucoseStatus;
  label: string;
  color: string;
  advice: string;
} {
  if (valueMgDl < 70) {
    return {
      status: 'hypoglycemia',
      label: 'Low (Hypoglycemia)',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      advice: 'Consume 15g of fast-acting carbohydrates immediately (juice, glucose tablet) and recheck in 15 minutes.',
    };
  }

  if (type === 'fasting') {
    if (valueMgDl <= 99) {
      return {
        status: 'normal',
        label: 'Optimal Fasting',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        advice: 'Normal healthy fasting blood glucose range.',
      };
    }
    if (valueMgDl <= 125) {
      return {
        status: 'elevated',
        label: 'Pre-diabetic Range',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        advice: 'Elevated fasting level. Monitor carbohydrate intake and discuss with your physician.',
      };
    }
    return {
      status: 'high',
      label: 'High (Diabetic Fasting)',
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      advice: 'Fasting glucose is above target. Ensure prescribed medications are taken as directed.',
    };
  }

  // Post-prandial / Random / Bedtime
  if (type === 'post_prandial') {
    if (valueMgDl <= 140) {
      return {
        status: 'normal',
        label: 'Normal Post-Meal',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        advice: 'Post-meal glucose managed effectively within normal target.',
      };
    }
    if (valueMgDl <= 199) {
      return {
        status: 'elevated',
        label: 'Elevated Post-Meal',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        advice: 'Post-prandial spike. Review meal composition and glycemic load.',
      };
    }
    return {
      status: 'high',
      label: 'High (Spike)',
      color: 'text-rose-700 bg-rose-50 border-rose-200',
      advice: 'Marked post-meal spike. Consult your physician regarding dose timing.',
    };
  }

  // General random / bedtime
  if (valueMgDl <= 140) {
    return {
      status: 'normal',
      label: 'Normal Blood Sugar',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      advice: 'Healthy glucose level.',
    };
  }
  if (valueMgDl <= 199) {
    return {
      status: 'elevated',
      label: 'Elevated',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      advice: 'Moderately elevated reading.',
    };
  }
  return {
    status: 'high',
    label: 'High Blood Sugar',
    color: 'text-rose-700 bg-rose-50 border-rose-200',
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
 * Evaluates Blood Pressure according to American Heart Association (AHA) standards
 */
export function evaluateBloodPressure(systolic: number, diastolic: number): {
  stage: BpStage;
  label: string;
  color: string;
  badgeBg: string;
  advice: string;
} {
  if (systolic >= 180 || diastolic >= 120) {
    return {
      stage: 'hypertensive_crisis',
      label: 'Hypertensive Crisis',
      color: 'text-rose-900',
      badgeBg: 'bg-rose-100 text-rose-900 border-rose-300 font-bold animate-pulse',
      advice: 'Critically high blood pressure. Rest quietly for 5 minutes and re-test. If still high or accompanied by headache/chest pain, seek emergency medical care immediately.',
    };
  }

  if (systolic >= 140 || diastolic >= 90) {
    return {
      stage: 'stage_2',
      label: 'Stage 2 Hypertension',
      color: 'text-rose-800',
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-200 font-semibold',
      advice: 'Blood pressure is significantly elevated. Review antihypertensive medication adherence with your doctor.',
    };
  }

  if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) {
    return {
      stage: 'stage_1',
      label: 'Stage 1 Hypertension',
      color: 'text-amber-800',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
      advice: 'Mild hypertension. Maintain low dietary sodium and regular tracking.',
    };
  }

  if (systolic >= 120 && systolic <= 129 && diastolic < 80) {
    return {
      stage: 'elevated',
      label: 'Elevated BP',
      color: 'text-amber-700',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      advice: 'Systolic pressure is slightly above optimal. Focus on stress management and physical activity.',
    };
  }

  return {
    stage: 'normal',
    label: 'Normal Blood Pressure',
    color: 'text-emerald-800',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    advice: 'Optimal cardiovascular blood pressure reading.',
  };
}

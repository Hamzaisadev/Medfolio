import { describe, it, expect } from 'vitest';
import {
  mmolToMgDl,
  mgDlToMmol,
  evaluateGlucose,
  evaluateBloodPressure,
  calculateMap,
} from '../vitals';

describe('Vitals Domain Logic', () => {
  describe('Glucose Unit Conversion', () => {
    it('converts mmol/L to mg/dL correctly', () => {
      expect(mmolToMgDl(5.5)).toBe(99);
      expect(mmolToMgDl(7.0)).toBe(126);
    });

    it('converts mg/dL to mmol/L correctly', () => {
      expect(mgDlToMmol(100)).toBe(5.5);
      expect(mgDlToMmol(180)).toBe(10.0);
    });
  });

  describe('Blood Glucose Evaluation (ADA Targets)', () => {
    it('identifies hypoglycemia when below 70 mg/dL', () => {
      const result = evaluateGlucose(65, 'fasting');
      expect(result.status).toBe('hypoglycemia');
    });

    it('classifies fasting normal, prediabetic, and high', () => {
      expect(evaluateGlucose(85, 'fasting').status).toBe('normal');
      expect(evaluateGlucose(115, 'fasting').status).toBe('elevated');
      expect(evaluateGlucose(145, 'fasting').status).toBe('high');
    });

    it('classifies post-prandial glucose correctly', () => {
      expect(evaluateGlucose(130, 'post_prandial').status).toBe('normal');
      expect(evaluateGlucose(165, 'post_prandial').status).toBe('elevated');
      expect(evaluateGlucose(220, 'post_prandial').status).toBe('high');
    });

    it('CRITICAL: escalates a hyperglycaemic emergency to crisis', () => {
      // 600 mg/dL previously returned "High Blood Sugar — stay hydrated and
      // monitor closely", which is not safe advice for a DKA-range reading.
      for (const type of ['fasting', 'post_prandial', 'random', 'bedtime'] as const) {
        const result = evaluateGlucose(600, type);
        expect(result.status, type).toBe('crisis');
        expect(result.advice, type).toMatch(/emergency|seek medical care now/i);
      }
    });

    it('flags crisis from the 300 mg/dL threshold upward', () => {
      expect(evaluateGlucose(299, 'random').status).toBe('high');
      expect(evaluateGlucose(300, 'random').status).toBe('crisis');
    });

    it('CRITICAL: distinguishes severe hypoglycaemia from mild', () => {
      expect(evaluateGlucose(69, 'fasting').status).toBe('hypoglycemia');
      expect(evaluateGlucose(53, 'fasting').status).toBe('severe_hypoglycemia');
      expect(evaluateGlucose(40, 'random').advice).toMatch(/emergency services/i);
    });
  });

  describe('Blood Pressure Evaluation (AHA Standards)', () => {
    it('calculates Mean Arterial Pressure (MAP)', () => {
      // 120/80 -> 80 + (40/3) = 93
      expect(calculateMap(120, 80)).toBe(93);
      // 150/90 -> 90 + (60/3) = 110
      expect(calculateMap(150, 90)).toBe(110);
    });

    it('identifies normal blood pressure', () => {
      const result = evaluateBloodPressure(115, 75);
      expect(result.stage).toBe('normal');
    });

    it('identifies elevated blood pressure', () => {
      const result = evaluateBloodPressure(125, 78);
      expect(result.stage).toBe('elevated');
    });

    it('identifies Stage 1 hypertension', () => {
      const result = evaluateBloodPressure(134, 82);
      expect(result.stage).toBe('stage_1');
    });

    it('identifies Stage 2 hypertension', () => {
      const result = evaluateBloodPressure(148, 95);
      expect(result.stage).toBe('stage_2');
    });

    it('identifies Hypertensive Crisis', () => {
      const result = evaluateBloodPressure(185, 125);
      expect(result.stage).toBe('hypertensive_crisis');
    });

    it('CRITICAL: identifies hypotension instead of reporting it as optimal', () => {
      // 70/40 previously returned "Optimal cardiovascular blood pressure reading".
      const result = evaluateBloodPressure(70, 40);
      expect(result.stage).toBe('hypotension');
      expect(result.advice).toMatch(/below the normal range/i);
    });

    it('treats a low systolic or a low diastolic alone as hypotension', () => {
      expect(evaluateBloodPressure(85, 70).stage).toBe('hypotension');
      expect(evaluateBloodPressure(110, 55).stage).toBe('hypotension');
      expect(evaluateBloodPressure(90, 60).stage).toBe('normal');
    });

    it('still prioritises crisis over the low-BP check', () => {
      // A very wide pulse pressure must not be downgraded to hypotension.
      expect(evaluateBloodPressure(190, 55).stage).toBe('hypertensive_crisis');
    });
  });
});

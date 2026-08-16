import { describe, it, expect } from 'vitest';
import { checkRedFlags, EMERGENCY_HELPLINES } from '../redFlags';

describe('redFlags emergency triage (src/domain/redFlags.ts)', () => {
  it('fires for Cardiac symptoms in English, Roman Urdu, and Urdu script', () => {
    expect(checkRedFlags('I have severe chest pain and pressure').isEmergency).toBe(true);
    expect(checkRedFlags('seene me dard ho raha hai').isEmergency).toBe(true);
    expect(checkRedFlags('سینے میں درد ہے').isEmergency).toBe(true);
  });

  it('fires for Breathing difficulty in English and Roman Urdu', () => {
    expect(checkRedFlags("I can't breathe").isEmergency).toBe(true);
    expect(checkRedFlags('saans nahi aa rahi').isEmergency).toBe(true);
    expect(checkRedFlags('دم گھٹنا').isEmergency).toBe(true);
  });

  it('fires for Stroke symptoms in English and Roman Urdu', () => {
    expect(checkRedFlags('My face is drooping and one side weakness').isEmergency).toBe(true);
    expect(checkRedFlags('adha jism sun ho gaya hai').isEmergency).toBe(true);
    expect(checkRedFlags('falij ka asar').isEmergency).toBe(true);
    expect(checkRedFlags('فالج').isEmergency).toBe(true);
  });

  it('fires for Bleeding, Loss of Consciousness, Anaphylaxis, Poisoning', () => {
    expect(checkRedFlags('heavy bleeding that will not stop').isEmergency).toBe(true);
    expect(checkRedFlags('patient is unconscious and passed out').isEmergency).toBe(true);
    expect(checkRedFlags('throat swelling and cannot swallow').isEmergency).toBe(true);
    expect(checkRedFlags('took too many pills overdose').isEmergency).toBe(true);
    expect(checkRedFlags('zeher pee liya').isEmergency).toBe(true);
  });

  it('CRITICAL: mild symptoms like "mild headache since yesterday" do NOT fire emergency', () => {
    const res = checkRedFlags('I have a mild headache since yesterday and slight fatigue');
    expect(res.isEmergency).toBe(false);
    expect(res.matchedCategories).toEqual([]);
  });

  it('always includes standard Pakistan emergency helpline numbers (1122, 115, 1020)', () => {
    const res = checkRedFlags('chest pain');
    expect(res.emergencyNumbers).toEqual(EMERGENCY_HELPLINES);
    expect(res.emergencyNumbers.some((h) => h.number === '1122')).toBe(true);
    expect(res.emergencyNumbers.some((h) => h.number === '115')).toBe(true);
    expect(res.emergencyNumbers.some((h) => h.number === '1020')).toBe(true);
  });
});

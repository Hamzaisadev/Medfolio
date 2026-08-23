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

  it('CRITICAL: fires with a typographic apostrophe from a mobile keyboard', () => {
    // U+2019, which phone keyboards insert automatically. These previously
    // matched nothing at all.
    expect(checkRedFlags('I can’t breathe').isEmergency).toBe(true);
    expect(checkRedFlags('I can’t swallow, my throat is swelling').isEmergency).toBe(true);
    expect(checkRedFlags('he won’t wake up').isEmergency).toBe(true);
  });

  it('CRITICAL: fires for common natural phrasings, not just canonical ones', () => {
    for (const phrase of [
      'I am short of breath',
      'feeling breathless walking up stairs',
      'sudden pain in my chest',
      'my chest feels tight',
      'coughing up blood this morning',
      'baby is blue and not waking up',
      'worst headache ever, came on suddenly',
    ]) {
      expect(checkRedFlags(phrase).isEmergency, phrase).toBe(true);
    }
  });

  it('matches regardless of punctuation and spacing', () => {
    expect(checkRedFlags('CHEST   PAIN!!!').isEmergency).toBe(true);
    expect(checkRedFlags('Chest pain.').isEmergency).toBe(true);
    expect(checkRedFlags('(chest pain)').isEmergency).toBe(true);
  });

  it('reports which categories matched', () => {
    const res = checkRedFlags('chest pain and I can’t breathe');
    expect(res.matchedCategories).toContain('cardiac');
    expect(res.matchedCategories).toContain('breathing');
    expect(res.matchedLabels.length).toBe(res.matchedCategories.length);
  });

  it('still does not fire for everyday non-emergency text', () => {
    for (const phrase of [
      'I have a mild headache since yesterday',
      'slight fatigue and a runny nose',
      'my prescription says take one tablet after food',
      'when is my next appointment',
    ]) {
      expect(checkRedFlags(phrase).isEmergency, phrase).toBe(false);
    }
  });

  it('handles empty and nullish input', () => {
    expect(checkRedFlags('').isEmergency).toBe(false);
    expect(checkRedFlags(null).isEmergency).toBe(false);
    expect(checkRedFlags(undefined).isEmergency).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { resolveCanonicalTestName, areTestsEquivalent, getStandardTestName } from '../testAliases';

describe('testAliases (src/domain/testAliases.ts)', () => {
  it('resolves CBC and Blood CP both to Complete Blood Count', () => {
    expect(resolveCanonicalTestName('CBC')).toBe('Complete Blood Count');
    expect(resolveCanonicalTestName('Blood CP')).toBe('Complete Blood Count');
    expect(resolveCanonicalTestName('CP')).toBe('Complete Blood Count');
    expect(resolveCanonicalTestName('Complete Picture')).toBe('Complete Blood Count');
    expect(areTestsEquivalent('CBC', 'Blood CP')).toBe(true);
  });

  it('resolves LFTs, RFTs, and HbA1c to their canonical titles', () => {
    expect(resolveCanonicalTestName('LFT')).toBe('Liver Function Test');
    expect(resolveCanonicalTestName('RFT')).toBe('Renal Function Test');
    expect(resolveCanonicalTestName('KFT')).toBe('Renal Function Test');
    expect(resolveCanonicalTestName('HbA1c')).toBe('Glycated Hemoglobin');
  });

  it('CRITICAL: Vitamin D does NOT match Vitamin B12', () => {
    expect(resolveCanonicalTestName('Vit D')).toBe('Vitamin D');
    expect(resolveCanonicalTestName('Vit B12')).toBe('Vitamin B12');
    expect(areTestsEquivalent('Vitamin D', 'Vitamin B12')).toBe(false);
  });

  it('does NOT confuse Fasting Blood Sugar with Random Blood Sugar', () => {
    expect(resolveCanonicalTestName('FBS')).toBe('Fasting Blood Sugar');
    expect(resolveCanonicalTestName('RBS')).toBe('Random Blood Sugar');
    expect(areTestsEquivalent('FBS', 'RBS')).toBe(false);
  });

  it('handles regional Pakistan-specific epidemic tests (Dengue, Typhoid, Malaria, Hepatitis)', () => {
    expect(resolveCanonicalTestName('Dengue NS1')).toBe('Dengue NS1 Antigen');
    expect(resolveCanonicalTestName('Typhidot')).toBe('Typhoid Serology');
    expect(resolveCanonicalTestName('MP')).toBe('Malaria Test');
    expect(resolveCanonicalTestName('HBsAg')).toBe('Hepatitis B Surface Antigen');
    expect(resolveCanonicalTestName('Anti-HCV')).toBe('Hepatitis C Antibody');
  });

  it('resolves Creatinine, Creatine, and S. Creat to Serum Creatinine regardless of casing', () => {
    expect(resolveCanonicalTestName('creatine')).toBe('Serum Creatinine');
    expect(resolveCanonicalTestName('CREATINE')).toBe('Serum Creatinine');
    expect(resolveCanonicalTestName('creatinine')).toBe('Serum Creatinine');
    expect(resolveCanonicalTestName('CREATININE')).toBe('Serum Creatinine');
    expect(resolveCanonicalTestName('S. Creatinine')).toBe('Serum Creatinine');
    expect(resolveCanonicalTestName('s creat')).toBe('Serum Creatinine');
    expect(areTestsEquivalent('creatine', 'CREATININE')).toBe(true);
    expect(areTestsEquivalent('creatine', 'Serum Creatinine')).toBe(true);
  });

  it('getStandardTestName formats canonical and unmapped tests cleanly', () => {
    expect(getStandardTestName('creatine')).toBe('Serum Creatinine');
    expect(getStandardTestName('CREATININE')).toBe('Serum Creatinine');
    expect(getStandardTestName('hba1c')).toBe('Glycated Hemoglobin');
    expect(getStandardTestName('alt')).toBe('ALT / SGPT');
    expect(getStandardTestName('SGPT')).toBe('ALT / SGPT');

    // Unmapped custom tests converted to clean Title Case
    expect(getStandardTestName('D-DIMER')).toBe('D-dimer');
    expect(getStandardTestName('custom test name')).toBe('Custom Test Name');
  });
});


import { describe, it, expect } from 'vitest';
import { parseRange, evaluateRange, evaluateLabResult } from '../referenceRange';

describe('reference range parsing and evaluation (src/domain/referenceRange.ts)', () => {
  it('parses standard numeric intervals with various dashes and words', () => {
    expect(parseRange('12.0 - 16.0')).toEqual({ low: 12.0, high: 16.0 });
    expect(parseRange('12–16')).toEqual({ low: 12, high: 16 });
    expect(parseRange('12 to 16')).toEqual({ low: 12, high: 16 });
    expect(parseRange('0.4 - 4.0 mIU/L')).toEqual({ low: 0.4, high: 4.0 });
  });

  it('parses upper bound only formats', () => {
    expect(parseRange('< 100')).toEqual({ low: null, high: 100 });
    expect(parseRange('<100')).toEqual({ low: null, high: 100 });
    expect(parseRange('less than 100')).toEqual({ low: null, high: 100 });
    expect(parseRange('upto 100')).toEqual({ low: null, high: 100 });
  });

  it('parses lower bound only formats', () => {
    expect(parseRange('> 40')).toEqual({ low: 40, high: null });
    expect(parseRange('>= 40')).toEqual({ low: 40, high: null });
    expect(parseRange('greater than 40')).toEqual({ low: 40, high: null });
  });

  it('parses sex-specific reference ranges', () => {
    const rangeText = 'M: 13-17, F: 12-15';
    // When sex is male
    expect(parseRange(rangeText, 'male')).toEqual({ low: 13, high: 17 });
    // When sex is female
    expect(parseRange(rangeText, 'female')).toEqual({ low: 12, high: 15 });
    // When sex is unspecified or other -> unknown (do not arbitrarily guess)
    expect(parseRange(rangeText, null)).toEqual({ low: null, high: null });
    expect(parseRange(rangeText, 'other')).toEqual({ low: null, high: null });
  });

  it('parses qualitative expected values', () => {
    expect(parseRange('Negative')).toEqual({ low: null, high: null, qualitativeExpected: 'negative' });
    expect(parseRange('Non-reactive')).toEqual({ low: null, high: null, qualitativeExpected: 'non-reactive' });
  });

  it('returns unknown for unparseable input (NEVER creates false out-of-range)', () => {
    expect(parseRange('random gibberish')).toEqual({ low: null, high: null });
    expect(parseRange('')).toEqual({ low: null, high: null });
    expect(parseRange(null)).toEqual({ low: null, high: null });
  });

  it('correctly evaluates numeric values against ranges', () => {
    expect(evaluateRange(14, 12, 16)).toBe('within');
    expect(evaluateRange(10, 12, 16)).toBe('below');
    expect(evaluateRange(18, 12, 16)).toBe('above');

    // Upper bound only
    expect(evaluateRange(85, null, 100)).toBe('within');
    expect(evaluateRange(110, null, 100)).toBe('above');

    // Lower bound only
    expect(evaluateRange(50, 40, null)).toBe('within');
    expect(evaluateRange(30, 40, null)).toBe('below');

    // Unknown when bounds are missing or value is empty
    expect(evaluateRange(null, 12, 16)).toBe('unknown');
    expect(evaluateRange(14, null, null)).toBe('unknown');
  });

  it('evaluates qualitative values', () => {
    expect(evaluateRange('Negative', null, null, 'negative')).toBe('within');
    expect(evaluateRange('Positive', null, null, 'negative')).toBe('above');
    expect(evaluateRange('Indeterminate', null, null, 'negative')).toBe('unknown');
  });

  it('parses ranges written with thousands separators', () => {
    // A routine WBC range; the comma previously defeated the interval match.
    expect(parseRange('4,000 - 11,000')).toEqual({ low: 4000, high: 11000 });
    expect(parseRange('150,000-450,000')).toEqual({ low: 150000, high: 450000 });
    expect(parseRange('< 1,000')).toEqual({ low: null, high: 1000 });
  });

  it('does not merge separate numbers when stripping separators', () => {
    // "12,16" is not a thousands separator, so it must not become 1216.
    expect(parseRange('12,16')).toEqual({ low: null, high: null });
  });

  describe('evaluateLabResult', () => {
    it('CRITICAL: flags an abnormal qualitative result as out of range', () => {
      // Expected negative, got positive. This previously reported "unevaluated".
      const result = evaluateLabResult('Positive', 'Negative');
      expect(result.status).toBe('outside_range');
      expect(result.rangeStatus).toBe('above');
    });

    it('flags reactive, present, detected and trace results', () => {
      for (const value of ['Reactive', 'Present', 'Detected', 'Trace']) {
        expect(evaluateLabResult(value, 'Negative').status, value).toBe('outside_range');
      }
    });

    it('accepts a matching qualitative result', () => {
      expect(evaluateLabResult('Negative', 'Negative').status).toBe('within_range');
      expect(evaluateLabResult('Non-Reactive', 'Non-reactive').status).toBe('within_range');
    });

    it('leaves a genuinely ambiguous qualitative result unflagged', () => {
      expect(evaluateLabResult('Indeterminate', 'Negative').status).toBe('qualitative');
    });

    it('CRITICAL: resolves sex-specific ranges when sex is supplied', () => {
      // Haemoglobin 12.5 is normal for a female patient, low for a male one.
      const range = 'M: 13-17, F: 12-15';
      expect(evaluateLabResult('12.5', range, 'female').status).toBe('within_range');
      expect(evaluateLabResult('12.5', range, 'male').status).toBe('outside_range');
      expect(evaluateLabResult('12.5', range, 'male').rangeStatus).toBe('below');
    });

    it('does not guess a sex-specific range when sex is unknown', () => {
      expect(evaluateLabResult('12.5', 'M: 13-17, F: 12-15', null).status).toBe('unevaluated');
      expect(evaluateLabResult('12.5', 'M: 13-17, F: 12-15').status).toBe('unevaluated');
    });

    it('evaluates plain numeric ranges', () => {
      expect(evaluateLabResult('14', '12 - 16').status).toBe('within_range');
      expect(evaluateLabResult('18', '12 - 16').rangeStatus).toBe('above');
      expect(evaluateLabResult('8000', '4,000 - 11,000').status).toBe('within_range');
    });

    it('returns unevaluated rather than a false result for unparseable input', () => {
      expect(evaluateLabResult('14', 'see comments').status).toBe('unevaluated');
      expect(evaluateLabResult('', '12 - 16').status).toBe('unevaluated');
    });
  });
});

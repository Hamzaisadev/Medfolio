import { describe, it, expect } from 'vitest';
import { parseRange, evaluateRange } from '../referenceRange';

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
});

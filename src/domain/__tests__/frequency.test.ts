import { describe, it, expect } from 'vitest';
import { parseFrequency, defaultDoseTimes } from '../frequency';

describe('frequency parsing (src/domain/frequency.ts)', () => {
  it('parses OD and its variants', () => {
    expect(parseFrequency('od')).toBe('OD');
    expect(parseFrequency('o.d.')).toBe('OD');
    expect(parseFrequency('1x')).toBe('OD');
    expect(parseFrequency('once')).toBe('OD');
    expect(parseFrequency('once daily')).toBe('OD');
    expect(parseFrequency('once a day')).toBe('OD');
    expect(parseFrequency('daily')).toBe('OD');
    expect(parseFrequency('1 time')).toBe('OD');
    expect(parseFrequency('din me ek baar')).toBe('OD');
    expect(parseFrequency('din mein aik baar')).toBe('OD');
    expect(parseFrequency('روزانہ ایک بار')).toBe('OD');
  });

  it('parses BD and its variants', () => {
    expect(parseFrequency('bd')).toBe('BD');
    expect(parseFrequency('b.d.')).toBe('BD');
    expect(parseFrequency('bid')).toBe('BD');
    expect(parseFrequency('b.i.d.')).toBe('BD');
    expect(parseFrequency('2x')).toBe('BD');
    expect(parseFrequency('twice')).toBe('BD');
    expect(parseFrequency('twice daily')).toBe('BD');
    expect(parseFrequency('12 hourly')).toBe('BD');
    expect(parseFrequency('q12h')).toBe('BD');
    expect(parseFrequency('din me do baar')).toBe('BD');
  });

  it('parses TDS and its variants', () => {
    expect(parseFrequency('tds')).toBe('TDS');
    expect(parseFrequency('t.d.s.')).toBe('TDS');
    expect(parseFrequency('tid')).toBe('TDS');
    expect(parseFrequency('3x')).toBe('TDS');
    expect(parseFrequency('thrice')).toBe('TDS');
    expect(parseFrequency('three times')).toBe('TDS');
    expect(parseFrequency('8 hourly')).toBe('TDS');
    expect(parseFrequency('q8h')).toBe('TDS');
    expect(parseFrequency('din me teen baar')).toBe('TDS');
  });

  it('parses QID and its variants', () => {
    expect(parseFrequency('qid')).toBe('QID');
    expect(parseFrequency('qds')).toBe('QID');
    expect(parseFrequency('4x')).toBe('QID');
    expect(parseFrequency('four times')).toBe('QID');
    expect(parseFrequency('6 hourly')).toBe('QID');
    expect(parseFrequency('q6h')).toBe('QID');
  });

  it('parses slot notation, Bengali numerals, and OCR artifacts (e.g. 1+0+1, ১+০+১, >+0+>)', () => {
    expect(parseFrequency('1+0+1')).toBe('BD');
    expect(parseFrequency('1-0-1')).toBe('BD');
    expect(parseFrequency('1/0/1')).toBe('BD');
    expect(parseFrequency('1+1+1')).toBe('TDS');
    expect(parseFrequency('1+1+1+1')).toBe('QID');
    expect(parseFrequency('1+0+0')).toBe('OD');
    expect(parseFrequency('0+0+1')).toBe('QHS');
    expect(parseFrequency('১+০+১')).toBe('BD');
    expect(parseFrequency('১+১+১')).toBe('TDS');
    expect(parseFrequency('۱+۰+۱')).toBe('BD');
    expect(parseFrequency('>+0+>')).toBe('BD');
  });

  it('parses hourly variants and custom intervals', () => {
    expect(parseFrequency('q24h')).toBe('OD');
    expect(parseFrequency('q5h')).toBe('CUSTOM');
  });

  it('parses QHS (bedtime) and its variants', () => {
    expect(parseFrequency('hs')).toBe('QHS');
    expect(parseFrequency('qhs')).toBe('QHS');
    expect(parseFrequency('at night')).toBe('QHS');
    expect(parseFrequency('bedtime')).toBe('QHS');
    expect(parseFrequency('before sleep')).toBe('QHS');
    expect(parseFrequency('raat ko')).toBe('QHS');
    expect(parseFrequency('sote waqt')).toBe('QHS');
  });

  it('parses PRN / SOS and its variants', () => {
    expect(parseFrequency('prn')).toBe('PRN');
    expect(parseFrequency('sos')).toBe('PRN');
    expect(parseFrequency('as needed')).toBe('PRN');
    expect(parseFrequency('if required')).toBe('PRN');
    expect(parseFrequency('when necessary')).toBe('PRN');
    expect(parseFrequency('zaroorat par')).toBe('PRN');
  });

  it('parses STAT and WEEKLY', () => {
    expect(parseFrequency('stat')).toBe('STAT');
    expect(parseFrequency('immediately')).toBe('STAT');
    expect(parseFrequency('at once')).toBe('STAT');
    expect(parseFrequency('abhi')).toBe('STAT');

    expect(parseFrequency('weekly')).toBe('WEEKLY');
    expect(parseFrequency('once a week')).toBe('WEEKLY');
    expect(parseFrequency('q7d')).toBe('WEEKLY');
    expect(parseFrequency('hafte me ek baar')).toBe('WEEKLY');
  });

  it('returns null on unrecognised input (NEVER guesses or defaults to BD)', () => {
    expect(parseFrequency('xyz')).toBeNull();
    expect(parseFrequency('random text')).toBeNull();
    expect(parseFrequency('')).toBeNull();
    expect(parseFrequency(null)).toBeNull();
    expect(parseFrequency(undefined)).toBeNull();
  });

  it('generates zero dose times for PRN/SOS', () => {
    expect(defaultDoseTimes('PRN')).toEqual([]);
    expect(defaultDoseTimes('SOS')).toEqual([]);
  });

  it('generates default dose times for all codes and slot patterns', () => {
    expect(defaultDoseTimes('OD', true)).toEqual([540]);
    expect(defaultDoseTimes('OD', false)).toEqual([420]);
    expect(defaultDoseTimes('BD')).toEqual([540, 1260]);
    // `1+0+1` means the same as BD, so it must resolve to the same slots.
    expect(defaultDoseTimes('BD', true, '1+0+1')).toEqual([540, 1260]);
    expect(defaultDoseTimes('TDS')).toEqual([480, 840, 1200]);
    expect(defaultDoseTimes('QID')).toEqual([480, 720, 960, 1200]);
    expect(defaultDoseTimes('QHS')).toEqual([1320]);
    expect(defaultDoseTimes('STAT')).toEqual([540]);
    expect(defaultDoseTimes('WEEKLY')).toEqual([540]);
    expect(defaultDoseTimes('CUSTOM')).toEqual([540]);
  });

  it('uses the standard morning slot when the meal relation is unknown', () => {
    // null means "the prescription did not say", which must not be read as a
    // confirmed empty-stomach instruction.
    expect(defaultDoseTimes('OD', null)).toEqual([540]);
    expect(defaultDoseTimes('OD', undefined)).toEqual([540]);
    expect(defaultDoseTimes('BD', null)).toEqual([540, 1260]);
  });

  it('shifts only the morning dose for a confirmed empty stomach instruction', () => {
    expect(defaultDoseTimes('BD', false)).toEqual([420, 1260]);
    expect(defaultDoseTimes('QHS', false)).toEqual([1320]);
  });

  it('resolves every slot pattern to a canonical set of times', () => {
    expect(defaultDoseTimes('BD', true, '1+1+0')).toEqual([540, 840]);
    expect(defaultDoseTimes('BD', true, '0+1+1')).toEqual([840, 1260]);
    expect(defaultDoseTimes('OD', true, '1+0+0')).toEqual([540]);
    expect(defaultDoseTimes('QHS', true, '0+0+1')).toEqual([1320]);
  });

  it('returns no dose times for a null code even with slot notation', () => {
    expect(defaultDoseTimes(null, true, '1+0+1')).toEqual([]);
  });
});

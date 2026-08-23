/**
 * Meal relation for a medicine dose.
 *
 * `with_food` is nullable, and a null means "the prescription did not say" —
 * NOT "take on an empty stomach". Treating null as a definite instruction
 * silently invents clinical guidance, so every surface must go through here.
 */

export type MealRelation = 'with_food' | 'empty_stomach' | 'unspecified';

export function mealRelationOf(withFood: boolean | null | undefined): MealRelation {
  if (withFood === true) return 'with_food';
  if (withFood === false) return 'empty_stomach';
  return 'unspecified';
}

/** Short label for tables and badges. */
export function mealRelationLabel(withFood: boolean | null | undefined): string {
  switch (mealRelationOf(withFood)) {
    case 'with_food':
      return 'With food';
    case 'empty_stomach':
      return 'Empty stomach';
    case 'unspecified':
      return 'Not specified';
  }
}

/**
 * Patient-facing instruction.
 *
 * Plain text only — the icon is the UI's job. Emoji embedded in a domain string
 * cannot inherit colour, render differently on every platform, and get read aloud
 * by screen readers as their unicode name.
 */
export function mealRelationInstruction(withFood: boolean | null | undefined): string {
  switch (mealRelationOf(withFood)) {
    case 'with_food':
      return 'Take with or after meals';
    case 'empty_stomach':
      return 'Take on an empty stomach';
    case 'unspecified':
      return 'Meal timing not specified — follow your doctor’s instructions';
  }
}

/**
 * Morning dose time in minutes since midnight.
 *
 * Only a confirmed empty-stomach instruction shifts the dose earlier; an
 * unspecified meal relation uses the standard morning slot.
 */
export function morningDoseMinutes(withFood: boolean | null | undefined): number {
  return mealRelationOf(withFood) === 'empty_stomach' ? 420 : 540; // 07:00 vs 09:00
}

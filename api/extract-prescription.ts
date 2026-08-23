import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyAuthToken } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import { generateStructured } from './_lib/gemini';
import { readJsonBody, sendError, sendJson } from './_lib/http';
import {
  extractPrescriptionRequestSchema,
  extractPrescriptionResponseSchema,
} from './_lib/schemas';

const SYSTEM_INSTRUCTION = `You read photographs of medical prescriptions, including handwritten and typed ones from South Asia (Pakistan, India, Bangladesh) and globally.
Extract what is written and return clean JSON matching the schema.

Critical rules:
1. STRICT ENGLISH ONLY: Translate ALL extracted text into clear, standard English. NEVER output Bengali, Hindi, Urdu, Arabic, or other non-Latin scripts in any field.
   - For example, translate "খাওয়ার পর" (Bengali), "کھانے کے بعد" (Urdu), or "खाने के बाद" (Hindi) to "After meals / After food".
   - Translate "খাওয়ার আগে" or "نہار منہ" to "Empty stomach (Before food)".
   - Translate doctor advice, diagnoses, and clinic names to English.
2. DOCTOR FREQUENCY TRANSLATION:
   - When written in numeric slot shorthand (e.g. 1+0+1, 1+1+1, 0+0+1, 1+0+0, 1-0-1, ১+০+১, ۱+۰+۱):
     - Translate 1+0+1 or 1-0-1 to "Morning & Night (2 times daily)"
     - Translate 1+1+1 or 1-1-1 to "Morning, Afternoon & Night (3 times daily)"
     - Translate 1+0+0 to "Morning only (Once daily)"
     - Translate 0+0+1 to "Night at bedtime (Once daily)"
     - Translate 0+1+0 to "Afternoon only (Once daily)"
     - Translate 1+1+1+1 to "4 times daily (Morning, Noon, Evening, Night)"
   - Standard Latin abbreviations (BD, TDS, OD, QID, HS, PRN):
     - BD / bid -> "Twice daily (Morning & Night)"
     - TDS / tid -> "Three times daily (Morning, Afternoon & Night)"
     - OD / qd -> "Once daily (Morning)"
     - QHS / hs -> "Night at bedtime"
     - PRN / SOS -> "As needed (When required)"
3. MEAL TIMING (with_food):
   - If instructions state after food / after meals / with meals: set with_food: true.
   - If instructions state before food / empty stomach: set with_food: false.
   - If not mentioned: set with_food: null.
4. VISIT DATE EXTRACTION:
   - Search the prescription image thoroughly for the consultation/visit date (check top header, 'Date:', near doctor signature/stamp, or bottom footer).
   - Format the date in standardized YYYY-MM-DD format (e.g. 2026-08-23).
   - If no date is written on the prescription, return null (the server will automatically default to the upload date).
5. Accuracy & Minimizing User Effort:
   - Never invent a diagnosis. If no reason for the visit is written, return null.
   - Never guess a medicine name. If handwriting is ambiguous, return your closest reading and mark confidence: "low".
   - If nothing is readable in the photo, return readable: false with empty arrays.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean' },
    doctor_name: { type: 'string', nullable: true },
    clinic_name: { type: 'string', nullable: true },
    visit_date: { type: 'string', nullable: true },
    diagnosis: { type: 'string', nullable: true },
    doctor_advice: { type: 'string', nullable: true },
    follow_up: { type: 'string', nullable: true },
    medicines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          medicine_name: { type: 'string' },
          strength: { type: 'string', nullable: true },
          form: { type: 'string', nullable: true },
          dose_amount: { type: 'string', nullable: true },
          frequency_raw: { type: 'string', nullable: true },
          duration_raw: { type: 'string', nullable: true },
          instructions: { type: 'string', nullable: true },
          with_food: { type: 'boolean', nullable: true },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
        required: ['medicine_name'],
      },
    },
    tests_ordered: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          test_name: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
        required: ['test_name'],
      },
    },
  },
  required: ['readable', 'medicines', 'tests_ordered'],
};

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const { userId } = await verifyAuthToken(req.headers['authorization']);

    const { allowed } = checkRateLimit(userId, 20);
    if (!allowed) {
      sendJson(res, 429, { error: 'Rate limit exceeded. Please wait a minute.' });
      return;
    }

    const { images } = extractPrescriptionRequestSchema.parse(await readJsonBody(req));

    const parts = images.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.dataBase64,
      },
    }));

    const result = await generateStructured({
      systemInstruction: SYSTEM_INSTRUCTION,
      parts,
      responseSchema: RESPONSE_SCHEMA,
      validate: (raw) => extractPrescriptionResponseSchema.parse(raw),
      temperature: 0,
    });

    sendJson(res, 200, {
      data: result.data,
      raw_response: result.rawResponse,
      model: result.model,
    });
  } catch (err: unknown) {
    sendError(res, 'Prescription extraction error', err);
  }
}

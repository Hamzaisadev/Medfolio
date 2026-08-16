import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyAuthToken } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import { generateStructured } from './_lib/gemini';
import { readJsonBody, sendError, sendJson } from './_lib/http';
import {
  extractPrescriptionRequestSchema,
  extractPrescriptionResponseSchema,
} from './_lib/schemas';

const SYSTEM_INSTRUCTION = `You read photographs of medical prescriptions, including handwritten ones from Pakistan.
Extract only what is actually written. Return JSON matching the schema.

Critical rules:
- Never invent a diagnosis. If no reason for the visit is written, return null.
- Never guess a medicine name. If the handwriting is unclear, return your best reading and mark confidence: "low".
- Copy frequency and duration verbatim as written (BD, TDS, x5, 5/7, din me 2 baar) into the frequency_raw and duration_raw fields. Do not normalise or interpret them — the application does that.
- Never fill in a frequency or duration that is not written. Return null.
- Understand English, Urdu, and Roman Urdu.
- Extract lab tests and investigations the doctor ordered into tests_ordered.
- If nothing is readable in the photo, return readable: false with empty arrays rather than inventing content.`;

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

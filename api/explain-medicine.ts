import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyAuthToken } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import { generateStructured } from './_lib/gemini';
import { readJsonBody, sendError, sendJson } from './_lib/http';
import {
  explainMedicineRequestSchema,
  explainMedicineResponseSchema,
} from './_lib/schemas';

const SYSTEM_INSTRUCTION = `You explain medications to patients in plain language.
Never give medical advice, make diagnostic claims, or tell the patient to change their dose.
Always use neutral, informative tone.
Understand both generic and Pakistani brand names (e.g. Augmentin, Panadol, Arinac, Risek, Softin, Xb).
Return JSON matching the schema.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    medicine_name: { type: 'string' },
    summary: { type: 'string' },
    purpose: { type: 'string' },
    common_instructions: { type: 'string' },
  },
  required: ['medicine_name', 'summary', 'purpose', 'common_instructions'],
};

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const { userId } = await verifyAuthToken(req.headers['authorization']);

    const { allowed } = checkRateLimit(userId, 30);
    if (!allowed) {
      sendJson(res, 429, { error: 'Rate limit exceeded. Please wait a minute.' });
      return;
    }

    const { medicine_name } = explainMedicineRequestSchema.parse(await readJsonBody(req));

    const result = await generateStructured({
      systemInstruction: SYSTEM_INSTRUCTION,
      parts: [
        {
          text: `Explain this medication in simple, clear language: ${medicine_name}`,
        },
      ],
      responseSchema: RESPONSE_SCHEMA,
      validate: (raw) => explainMedicineResponseSchema.parse(raw),
      temperature: 0,
    });

    sendJson(res, 200, {
      data: result.data,
      raw_response: result.rawResponse,
      model: result.model,
    });
  } catch (err: unknown) {
    sendError(res, 'Explain medicine error', err);
  }
}

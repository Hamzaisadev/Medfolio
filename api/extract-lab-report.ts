import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyAuthToken } from './_lib/auth';
import { checkRateLimit } from './_lib/rateLimit';
import { generateStructured } from './_lib/gemini';
import { readJsonBody, sendError, sendJson } from './_lib/http';
import {
  extractLabReportRequestSchema,
  extractLabReportResponseSchema,
} from './_lib/schemas';

const SYSTEM_INSTRUCTION = `Extract test results printed on this lab report. Return only values actually printed.
For each row:
- test_name: Standardized clinical test name (e.g. "Serum Creatinine", "Hemoglobin", "HbA1c", "Platelet Count", "ALT / SGPT"). Avoid all-caps or idiosyncratic uppercase/lowercase formatting.
- value_text: The numeric or qualitative value exactly as printed on the report.
- unit: The measurement unit as printed (e.g. "mg/dL", "%", "U/L", "g/dL").
- reference_range: The reference or normal range string as printed.
Do not judge whether a value is normal or abnormal — the application computes that.
Qualitative results (Negative, Non-reactive, Nil) go in the value_text field as text.
If a page contains no test results, return an empty array for results.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean' },
    title: { type: 'string', nullable: true },
    lab_name: { type: 'string', nullable: true },
    report_date: { type: 'string', nullable: true },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          test_name: { type: 'string' },
          value_text: { type: 'string' },
          unit: { type: 'string', nullable: true },
          reference_range: { type: 'string', nullable: true },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
        required: ['test_name', 'value_text'],
      },
    },
  },
  required: ['readable', 'results'],
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

    const { images } = extractLabReportRequestSchema.parse(await readJsonBody(req));

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
      validate: (raw) => extractLabReportResponseSchema.parse(raw),
      temperature: 0,
    });

    sendJson(res, 200, {
      data: result.data,
      raw_response: result.rawResponse,
      model: result.model,
    });
  } catch (err: unknown) {
    sendError(res, 'Lab report extraction error', err);
  }
}

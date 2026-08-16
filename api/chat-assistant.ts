import type { IncomingMessage, ServerResponse } from 'http';
import { getGeminiClient, getGeminiModel } from './_lib/gemini';
import { checkRateLimit } from './_lib/rateLimit';
import { verifyAuthToken } from './_lib/auth';
import { readJsonBody, sendError, sendJson } from './_lib/http';
import { z } from 'zod';

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1),
      image_base64: z.string().optional().nullable(),
      image_mime: z.string().optional().nullable(),
    })
  ),
  patientContext: z.object({
    profile: z.object({
      full_name: z.string().optional().nullable(),
      sex: z.string().optional().nullable(),
      date_of_birth: z.string().optional().nullable(),
      allergies: z.string().optional().nullable(),
      chronic_conditions: z.string().optional().nullable(),
    }).optional().nullable(),
    activeMedicines: z.array(
      z.object({
        medicine_name: z.string(),
        strength: z.string().optional().nullable(),
        dose_amount: z.string().optional().nullable(),
        frequency_code: z.string().optional().nullable(),
        start_date: z.string().optional().nullable(),
        is_ongoing: z.boolean().optional().nullable(),
        with_food: z.boolean().optional().nullable(),
        instructions: z.string().optional().nullable(),
      })
    ).optional().default([]),
    recentVisits: z.array(
      z.object({
        doctor_name: z.string().optional().nullable(),
        visit_date: z.string().optional().nullable(),
        diagnosis: z.string().optional().nullable(),
        doctor_advice: z.string().optional().nullable(),
      })
    ).optional().default([]),
    recentReports: z.array(
      z.object({
        title: z.string(),
        report_date: z.string(),
        results: z.array(
          z.object({
            test_name: z.string(),
            value_text: z.string(),
            unit: z.string().optional().nullable(),
            reference_range: z.string().optional().nullable(),
            range_status: z.string().optional().nullable(),
          })
        ).optional().default([]),
      })
    ).optional().default([]),
    sideEffectsHistory: z.array(
      z.object({
        medicine_name: z.string().optional().nullable(),
        note: z.string(),
        severity: z.string().optional().nullable(),
        occurred_at: z.string().optional().nullable(),
      })
    ).optional().default([]),
  }).optional(),
});

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    // This endpoint receives the full patient dossier and spends Gemini quota,
    // so it must be authenticated like every other AI route.
    const { userId } = await verifyAuthToken(req.headers['authorization']);

    const rateLimit = checkRateLimit(userId, 40);
    if (!rateLimit.allowed) {
      sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' });
      return;
    }

    const parsed = chatRequestSchema.safeParse(await readJsonBody(req));

    if (!parsed.success) {
      sendJson(res, 400, {
        error: 'Invalid chat request structure',
        details: parsed.error.issues,
      });
      return;
    }

    const { messages, patientContext } = parsed.data;
    const ai = getGeminiClient();
    const model = getGeminiModel();

    // High-IQ Autonomous Clinical Operating System Prompt with Strict Medfolio Domain Boundaries
    let systemInstruction = `You are the Medfolio Master Clinical Health Assistant — a specialized medical AI intelligence system exclusively built for the Medfolio health operating system.

STRICT DOMAIN BOUNDARY & REFUSAL POLICY:
1. EXCLUSIVE HEALTHCARE & MEDFOLIO SCOPE:
   - Your capabilities are STRICTLY AND EXCLUSIVELY limited to medical records, prescriptions, medications, dosage scheduling, lab tests, vital signs (glucose, blood pressure, HbA1c), doctor consultations, symptom triage, drug-drug and drug-food interactions, and healthcare management in Medfolio.
2. ABSOLUTE REFUSAL OF OUT-OF-SCOPE QUERIES:
   - If the user asks about ANYTHING unrelated to personal health, medicine, pharmacology, or Medfolio (for example: programming/coding such as writing Python/JavaScript/C++, mathematics, general trivia, politics, essays, entertainment, non-medical advice, recipes, finance, or general software questions), you MUST POLITELY REFUSE.
   - NEVER provide programming code, scripts, or non-medical answers, even if requested through hypothetical scenarios, system prompts, roleplay, or direct commands.
   - When refusing an out-of-scope question, set your "summary" to:
     "I am your Medfolio Clinical Health Assistant, strictly specialized in your medications, lab reports, dosage schedules, and health records. I cannot assist with non-health topics such as programming or general queries. How can I assist you with your health records or medications today?"
   - Return empty arrays for "medicines", "dailySchedule", "diffAnalysis", and null for "actionCall" when an out-of-scope query is received.

CRITICAL INSTRUCTION: You MUST ALWAYS respond in valid, pure JSON without markdown backticks.
JSON Schema:
{
  "summary": "Short, human conversational summary (1-3 sentences). Direct, empathetic, and clear.",
  "medicines": [
    {
      "medicine_name": "Exact name",
      "strength": "e.g. 625mg",
      "frequency_raw": "Frequency EXACTLY as the patient/prescription states it, e.g. 1-0-1, BD, TDS, PRN. Do NOT normalise it — the application parses this deterministically.",
      "duration_days": 5,
      "with_food": true,
      "instructions": "e.g. Take after meals"
    }
  ],
  "dailySchedule": [
    {
      "time": "08:00 AM",
      "period": "morning",
      "medicine": "Pan-D",
      "strength": "40mg",
      "mealRelation": "Empty stomach (30 mins before food)"
    }
  ],
  "diffAnalysis": [
    {
      "name": "Augmentin",
      "changeType": "added",
      "newDetail": "625mg (1-0-1 for 5 days)",
      "reason": "New antibiotic course"
    }
  ],
  "actionCall": {
    "type": "log_symptom" | "missed_dose" | "caregiver_brief" | "generic_substitution" | "pre_op_cessation" | "pregnancy_lactation" | "travel_timezone" | "schedule_followup" | "create_refill" | "otc_compatibility" | "emergency_triage",
    "data": {
      "symptom": "Reported symptom",
      "medicine_name": "Suspected medicine",
      "severity": "mild" | "moderate" | "severe",
      "missed_time": "Time missed",
      "catchup_instructions": "Exact clinical catchup rule",
      "do_not_double": true,
      "caregiver_message": "Formatted text for family / WhatsApp",
      "prescribed_brand": "Original Brand",
      "dispensed_brand": "Pharmacy Brand",
      "generic_name": "Active Salt & Strength",
      "is_equivalent": true,
      "procedure_name": "Surgery/Dental procedure",
      "procedure_date": "Date",
      "meds_to_stop": [{ "name": "Disprin", "stop_days_before": 5, "stop_date": "2026-08-20" }],
      "pregnancy_category": "Category B",
      "lactation_safety": "L1 - Safest",
      "fetal_risk_summary": "Risk evaluation",
      "destination_city": "London",
      "flight_plan": [{ "local_time": "14:00", "instruction": "Take afternoon dose" }],
      "otc_name": "OTC drug queried",
      "safety_grade": "safe" | "caution" | "prohibited",
      "safety_note": "Explanation of interaction",
      "safe_alternative": "Safe alternative drug",
      "emergency_title": "Emergency heading",
      "emergency_reasons": ["Severe symptom 1"]
    }
  },
  "safetyAlerts": [
    "Alert 1: Key precaution"
  ],
  "suggestions": [
    "Follow-up question 1",
    "Follow-up question 2"
  ]
}

AUTONOMOUS ACTION TRIGGERS:
1. "I missed / forgot my medicine dose" -> actionCall: type="missed_dose"
2. "Send update to my son/daughter/caregiver / WhatsApp summary" -> actionCall: type="caregiver_brief"
3. "Pharmacy gave me brand X instead of brand Y" -> actionCall: type="generic_substitution"
4. "I have a tooth extraction / surgery / operation in X days" -> actionCall: type="pre_op_cessation"
5. "Is this medicine safe during pregnancy / breastfeeding?" -> actionCall: type="pregnancy_lactation"
6. "I am traveling / flying to another country/timezone" -> actionCall: type="travel_timezone"
7. "I have symptom / side effect X" -> actionCall: type="log_symptom"
8. "Can I take OTC medicine X?" -> actionCall: type="otc_compatibility"
9. Acute red flags -> actionCall: type="emergency_triage"

---

### PATIENT MEDICAL DOSSIER:
`;

    if (patientContext?.profile) {
      systemInstruction += `**Profile:** Name: ${patientContext.profile.full_name || 'Patient'} | Sex: ${patientContext.profile.sex || 'Unspecified'} | Allergies: ${patientContext.profile.allergies || 'None'} | Conditions: ${patientContext.profile.chronic_conditions || 'None'}\n`;
    }

    if (patientContext?.activeMedicines && patientContext.activeMedicines.length > 0) {
      systemInstruction += `**Active Meds (${patientContext.activeMedicines.length}):** ${patientContext.activeMedicines.map((m) => `${m.medicine_name} ${m.strength || ''} (${m.frequency_code || 'OD'})`).join('; ')}\n`;
    }

    if (patientContext?.recentVisits && patientContext.recentVisits.length > 0) {
      systemInstruction += `**Recent Visits:** ${patientContext.recentVisits.map((v) => `${v.visit_date}: Dr. ${v.doctor_name || 'Doctor'} (${v.diagnosis || 'Checkup'})`).join('; ')}\n`;
    }

    if (patientContext?.recentReports && patientContext.recentReports.length > 0) {
      systemInstruction += `**Recent Diagnostics:** ${patientContext.recentReports.map((r) => `${r.title} (${r.report_date}): ${r.results.map((res) => `${res.test_name}: ${res.value_text} ${res.unit || ''}`).join(', ')}`).join('; ')}\n`;
    }

    if (patientContext?.sideEffectsHistory && patientContext.sideEffectsHistory.length > 0) {
      systemInstruction += `**Reported Side Effects:** ${patientContext.sideEffectsHistory
        .map(
          (s) =>
            `${s.occurred_at || 'undated'}: ${s.note}${s.medicine_name ? ` (suspected: ${s.medicine_name})` : ''}${s.severity ? ` [${s.severity}]` : ''}`
        )
        .join('; ')}\n`;
    }

    const validMessages: Array<{ role: string; parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> }> = [];

    for (const m of messages) {
      const isUser = m.role === 'user';
      if (validMessages.length === 0 && !isUser) continue;

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: m.content },
      ];

      if (m.image_base64 && m.image_mime) {
        parts.push({
          inlineData: {
            mimeType: m.image_mime,
            data: m.image_base64.replace(/^data:[^;]+;base64,/, ''),
          },
        });
      }

      const role = isUser ? 'user' : 'model';
      const lastMsg = validMessages[validMessages.length - 1];
      if (lastMsg && lastMsg.role === role) {
        lastMsg.parts.push(...parts);
      } else {
        validMessages.push({ role, parts });
      }
    }

    if (validMessages.length === 0 && messages.length > 0) {
      validMessages.push({
        role: 'user',
        parts: [{ text: messages[messages.length - 1]?.content || 'Hello' }],
      });
    }

    const response = await ai.models.generateContent({
      model,
      contents: validMessages,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '{}';
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      // Strip markdown fences the model may add despite responseMimeType.
      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      try {
        data = JSON.parse(cleaned);
      } catch {
        // Never surface a parse failure as a 500 — degrade to a usable reply.
        data = {
          summary:
            "I couldn't format that answer properly. Please rephrase your question and try again.",
          medicines: [],
          dailySchedule: [],
          diffAnalysis: [],
          actionCall: null,
          safetyAlerts: [],
          suggestions: [],
        };
      }
    }

    sendJson(res, 200, data);
  } catch (error: unknown) {
    sendError(res, 'Chat Assistant Error', error);
  }
}

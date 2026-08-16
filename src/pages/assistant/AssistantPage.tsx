import { useState, useEffect, useRef, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Toast } from '../../components/ui/Toast';
import { Disclaimer } from '../../components/ui/Disclaimer';
import { MEDICINE_INFO_DISCLAIMER } from '../../lib/disclaimer';
import { medicinesRepo, visitsRepo, reportsRepo, profilesRepo, sideEffectsRepo } from '../../lib/db';
import { activeMedicines, type MedicineRecord } from '../../domain/activeMedicines';
import { todayInAppTz } from '../../lib/time';
import { DrugInteractionRadar } from '../../components/assistant/DrugInteractionRadar';
import { DoctorPrepBrief } from '../../components/assistant/DoctorPrepBrief';
import { BiomarkerTrajectory } from '../../components/assistant/BiomarkerTrajectory';
import { EditablePrescriptionWidget, type ExtractedMedItem } from '../../components/assistant/EditablePrescriptionWidget';
import { DailyScheduleClockWidget, type DailyScheduleSlot } from '../../components/assistant/DailyScheduleClockWidget';
import { PrescriptionDiffWidget, type PrescriptionDiffItem } from '../../components/assistant/PrescriptionDiffWidget';
import { ClinicalActionCards, type ClinicalActionCall } from '../../components/assistant/ClinicalActionCards';
import type { Tables } from '../../lib/supabase/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  image_base64?: string | null;
  image_mime?: string | null;
  medicines?: ExtractedMedItem[];
  dailySchedule?: DailyScheduleSlot[];
  diffAnalysis?: PrescriptionDiffItem[];
  actionCall?: ClinicalActionCall;
  safetyAlerts?: string[];
  suggestions?: string[];
}

const DEEP_CLINICAL_PROMPTS = [
  {
    title: '💊 Drug Interaction Check',
    prompt: 'Check all my active medicines for potential interactions and food timing conflicts.',
  },
  {
    title: '📊 Synthesize Lab Trends',
    prompt: 'Correlate my recent lab report results with my prescribed medicines.',
  },
  {
    title: '👨‍⚕️ Doctor Action Plan',
    prompt: 'Review advice from my last visit and give me follow-up questions for my next checkup.',
  },
  {
    title: '🍲 Daily Meal & Dose Timetable',
    prompt: 'Generate an exact daily timetable showing what time to take each medicine relative to food.',
  },
];

const CHAT_STORAGE_KEY = 'medfolio_assistant_messages_v2';

import { useAuth } from '../../lib/auth/AuthContext';

export function AssistantPage() {
  const { user, profile: authProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'radar' | 'doctor-prep' | 'biomarkers'>('chat');
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  
  // Persist messages in localStorage across page refreshes
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.error('Failed to parse saved chat history:', err);
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Welcome to your Medfolio Clinical Health Assistant. I am strictly specialized in managing your active prescriptions, dosage timings, lab reports, and health records. You can ask health questions, check drug interactions, or upload prescription photos.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mime: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [medicines, setMedicines] = useState<Tables<'medicines'>[]>([]);
  const [visits, setVisits] = useState<Tables<'visits'>[]>([]);
  const [reports, setReports] = useState<Tables<'reports'>[]>([]);
  const [resultsMap, setResultsMap] = useState<Record<string, Tables<'report_results'>[]>>({});
  const [sideEffects, setSideEffects] = useState<Tables<'side_effects'>[]>([]);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<unknown>(null);
  const today = todayInAppTz();

  const effectiveUserId = user?.id || authProfile?.user_id || '';
  const effectiveProfileId = authProfile?.id || effectiveUserId;

  const loadData = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const [p, mList, vList, rList, sList] = await Promise.all([
        profilesRepo.getDefaultProfile(effectiveUserId),
        medicinesRepo.listMedicines(effectiveUserId),
        visitsRepo.listVisits(effectiveProfileId),
        reportsRepo.listReports(effectiveUserId),
        sideEffectsRepo.listSideEffects(effectiveUserId),
      ]);
      setProfile(p);
      setMedicines(mList);
      setVisits(vList);
      setReports(rList);
      setSideEffects(sList);

      const map: Record<string, Tables<'report_results'>[]> = {};
      await Promise.all(
        rList.map(async (r) => {
          const res = await reportsRepo.listResultsForReport(r.id);
          map[r.id] = res;
        })
      );
      setResultsMap(map);
    } catch (err) {
      console.error('Failed to load patient records for assistant:', err);
    }
  }, [effectiveUserId, effectiveProfileId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (err) {
      console.error('Failed to save chat to localStorage:', err);
    }
  }, [messages]);

  const activeMedsList: MedicineRecord[] = activeMedicines(medicines, today);

  useEffect(() => {
    if (activeTab === 'chat' && chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, activeTab]);

  // Web Speech API - Speech Recognition
  const toggleSpeechRecognition = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToastMessage('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isRecording) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.stop();
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => r[0].transcript)
        .join('');
      setInput(transcript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      setToastMessage('Could not capture audio. Please check microphone permissions.');
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  // Text-To-Speech Playback
  const handleToggleSpeak = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setToastMessage('Audio playback not supported in this browser.');
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage({
        base64: reader.result as string,
        mime: file.type || 'image/jpeg',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if ((!text && !attachedImage) || isLoading) return;

    setActiveTab('chat');

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text || 'Please review this attached prescription and extract the medications.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      image_base64: attachedImage?.base64,
      image_mime: attachedImage?.mime,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    const currentImg = attachedImage;
    setAttachedImage(null);
    setIsLoading(true);

    try {
      const reportsWithResults = reports.slice(0, 3).map((r) => {
        const results = resultsMap[r.id] || [];
        return {
          title: r.title,
          report_date: r.report_date,
          results: results.map((res) => ({
            test_name: res.test_name,
            value_text: res.value_text,
            unit: res.unit,
            reference_range: res.reference_range,
            range_status: res.range_status,
          })),
        };
      });

      const patientContext = {
        profile: {
          full_name: profile?.full_name,
          sex: profile?.sex,
          date_of_birth: profile?.date_of_birth,
          allergies: Array.isArray(profile?.allergies) ? profile.allergies.join(', ') : profile?.allergies,
          chronic_conditions: Array.isArray(profile?.chronic_conditions) ? profile.chronic_conditions.join(', ') : profile?.chronic_conditions,
        },
        activeMedicines: activeMedsList.map((m) => ({
          medicine_name: m.medicine_name,
          strength: m.strength,
          dose_amount: m.dose_amount,
          frequency_code: m.frequency_code,
          start_date: m.start_date,
          is_ongoing: m.is_ongoing,
          with_food: m.with_food,
          instructions: m.instructions,
        })),
        recentVisits: visits.slice(0, 3).map((v) => ({
          doctor_name: v.doctor_name,
          visit_date: v.visit_date,
          diagnosis: v.diagnosis,
          doctor_advice: v.doctor_advice,
        })),
        recentReports: reportsWithResults,
        sideEffectsHistory: sideEffects.slice(0, 5).map((s) => ({
          medicine_name: s.medicine_name,
          note: s.note,
          severity: s.severity,
          occurred_at: s.occurred_at,
        })),
      };

      const response = await fetch('/api/chat-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
            image_base64: m.image_base64,
            image_mime: m.image_mime,
          })),
          patientContext,
        }),
      });

      const textRes = await response.text();
      let data: {
        summary?: string;
        reply?: string;
        medicines?: ExtractedMedItem[];
        dailySchedule?: DailyScheduleSlot[];
        diffAnalysis?: PrescriptionDiffItem[];
        actionCall?: ClinicalActionCall;
        safetyAlerts?: string[];
        suggestions?: string[];
        error?: string;
      } = {};

      try {
        data = textRes ? JSON.parse(textRes) : {};
      } catch {
        data = { summary: textRes };
      }

      if (!response.ok) throw new Error(data.error || 'Failed to get response');

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.summary || data.reply || 'Analysis complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        medicines: data.medicines || [],
        dailySchedule: data.dailySchedule || [],
        diffAnalysis: data.diffAnalysis || [],
        actionCall: data.actionCall,
        safetyAlerts: data.safetyAlerts || [],
        suggestions: data.suggestions || [],
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error communicating with assistant';
      const errMsg: Message = {
        id: `bot-err-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an issue: ${msg}. Please try again.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current && currentImg) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleQuickLogToTimeline = async (content: string) => {
    try {
      await sideEffectsRepo.createSideEffect({
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        medicine_name: 'Clinical Health Note',
        note: content.slice(0, 300),
        severity: 'mild',
        occurred_at: new Date().toISOString(),
      });
      setToastMessage('Note logged to your Medical Timeline.');
      loadData();
    } catch {
      setToastMessage('Failed to log to timeline.');
    }
  };

  return (
    <AppShell fullWidth noPadding fixedViewport>
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden w-full">
        {/* Top Header & Tab Controls */}
        <div className="shrink-0 pb-2 pt-1 border-b border-ink-200/80 bg-white/90 px-3 sm:px-4 rounded-xl mb-1.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-black text-ink-900 leading-tight">Clinical Health Assistant</h1>
              <Badge tone="ok" size="sm">Active Dossier Grounded</Badge>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowContextDrawer(!showContextDrawer)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  showContextDrawer
                    ? 'bg-teal-800 text-white border-teal-900 shadow-2xs'
                    : 'bg-white text-ink-700 border-ink-200 hover:bg-ink-50'
                }`}
              >
                <span>📁</span>
                <span>Active Context ({activeMedsList.length})</span>
              </button>

              <Button
                variant="ghost"
                size="sm"
                className="py-1 px-2 text-xs h-7"
                onClick={() => {
                  const initial: Message[] = [
                    {
                      id: 'welcome',
                      role: 'assistant',
                      content: 'Conversation cleared. How can I assist you with your health records?',
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ];
                  setMessages(initial);
                  try {
                    localStorage.removeItem(CHAT_STORAGE_KEY);
                  } catch (err) {
                    console.error('Failed to remove saved chat:', err);
                  }
                }}
              >
                Clear Chat
              </Button>
            </div>
          </div>

          {/* Tab Workspace Selector */}
          <div className="flex items-center gap-1 p-0.5 bg-ink-100/70 rounded-lg mt-1.5 max-w-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-1 px-2.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'chat'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-white/50'
              }`}
            >
              💬 Consultation Chat
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('radar')}
              className={`flex-1 py-1 px-2.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'radar'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-white/50'
              }`}
            >
              🔬 Interaction Radar
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('doctor-prep')}
              className={`flex-1 py-1 px-2.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'doctor-prep'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-white/50'
              }`}
            >
              👨‍⚕️ Doctor Visit Prep
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('biomarkers')}
              className={`flex-1 py-1 px-2.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                activeTab === 'biomarkers'
                  ? 'bg-white text-teal-900 shadow-xs'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-white/50'
              }`}
            >
              📈 Biomarker Trends
            </button>
          </div>
        </div>

        <Toast
          open={Boolean(toastMessage)}
          onClose={() => setToastMessage(null)}
          message={toastMessage || ''}
          tone="ok"
        />

        {/* Collapsible Active Context Drawer */}
        {showContextDrawer && (
          <div className="shrink-0 mb-2 p-3 bg-white border border-teal-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-teal-950">Patient Record Context Grounding</span>
              <button
                type="button"
                onClick={() => setShowContextDrawer(false)}
                className="text-ink-400 hover:text-ink-700 text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-ink-50 rounded-lg">
                <span className="text-ink-500 font-semibold block text-[10px] mb-0.5">Active Medications ({activeMedsList.length})</span>
                {activeMedsList.length === 0 ? (
                  <p className="text-ink-400 italic text-[11px]">No active prescriptions.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {activeMedsList.map((m) => (
                      <Badge key={m.id} tone="neutral" size="sm">
                        {m.medicine_name} {m.strength || ''}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-2 bg-ink-50 rounded-lg">
                <span className="text-ink-500 font-semibold block text-[10px] mb-0.5">Allergies & Conditions</span>
                <p className="text-ink-900 font-medium text-[11px]">
                  {profile?.allergies ? String(profile.allergies) : 'None recorded'}
                </p>
              </div>

              <div className="p-2 bg-ink-50 rounded-lg">
                <span className="text-ink-500 font-semibold block text-[10px] mb-0.5">Latest Consultation & Labs</span>
                <p className="text-ink-900 font-medium text-[11px] truncate">
                  {visits[0] ? `Dr. ${visits[0].doctor_name || 'Physician'} (${visits[0].visit_date})` : 'No recent visits'}
                </p>
                {reports[0] && (
                  <p className="text-teal-900 text-[10px] mt-0.5 truncate">{reports[0].title} ({reports[0].report_date})</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Full-Height Single Internal Scroll Chat */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col bg-white border border-ink-200/80 rounded-2xl shadow-xs overflow-hidden min-h-0">
            {/* Scrollable Messages Feed — THE ONLY SCROLLBAR */}
            <div ref={chatContainerRef} className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-4 bg-ink-50/20 text-xs sm:text-sm">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`p-4 sm:p-5 rounded-2xl leading-relaxed shadow-xs ${
                        m.role === 'user'
                          ? 'bg-teal-800 text-white rounded-br-none font-medium max-w-[85%] text-sm'
                          : 'bg-white border border-ink-200 text-ink-900 rounded-bl-none w-full max-w-3xl text-xs sm:text-[13.5px]'
                      }`}
                    >
                      {m.image_base64 && (
                        <img
                          src={m.image_base64}
                          alt="User attachment"
                          className="w-full max-h-64 object-cover rounded-xl mb-3 border border-black/10 shadow-xs"
                        />
                      )}
                      <p className="whitespace-pre-line leading-relaxed font-normal">{m.content}</p>

                      {/* 1. Interactive Editable Medicine Table if prescribed medicines were detected */}
                      {m.medicines && m.medicines.length > 0 && (
                        <EditablePrescriptionWidget
                          initialMedicines={m.medicines}
                          profileId={effectiveProfileId}
                          onAddedSuccess={(count) => {
                            setToastMessage(`Added ${count} medicines to your Cabinet & Timetable.`);
                            loadData();
                          }}
                        />
                      )}

                      {/* 2. Visual Chronological Daily Schedule Clock */}
                      {m.dailySchedule && m.dailySchedule.length > 0 && (
                        <DailyScheduleClockWidget slots={m.dailySchedule} />
                      )}

                      {/* 3. Prescription Difference Analyzer ("What Changed?") */}
                      {m.diffAnalysis && m.diffAnalysis.length > 0 && (
                        <PrescriptionDiffWidget diffs={m.diffAnalysis} />
                      )}

                      {/* 4. Autonomous Clinical Action Cards */}
                      {m.actionCall && (
                        <ClinicalActionCards
                          action={m.actionCall}
                          profileId={effectiveProfileId}
                          onExecuted={(msg) => {
                            setToastMessage(msg);
                            loadData();
                          }}
                        />
                      )}

                      {/* 5. Safety & Interaction Alerts */}
                      {m.safetyAlerts && m.safetyAlerts.length > 0 && (
                        <div className="mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60 text-xs space-y-1">
                          <span className="font-bold text-amber-950 block text-xs">⚠️ Critical Safety Radar:</span>
                          <ul className="list-disc list-inside space-y-0.5 text-amber-900 text-xs">
                            {m.safetyAlerts.map((alert, aIdx) => (
                              <li key={aIdx}>{alert}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {m.role === 'assistant' && m.id !== 'welcome' && (
                        <div className="mt-3 pt-2 border-t border-ink-100 flex items-center justify-between text-xs text-ink-400">
                          <div className="flex items-center gap-3">
                            <span>Grounded in active dossier</span>
                            <button
                              type="button"
                              onClick={() => handleToggleSpeak(m.id, m.content)}
                              className="text-ink-600 hover:text-ink-900 font-bold flex items-center gap-1"
                              title="Listen to audio response"
                            >
                              <span>{speakingMsgId === m.id ? '⏹️ Stop' : '🔊 Listen'}</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleQuickLogToTimeline(m.content)}
                            className="text-teal-800 hover:text-teal-950 font-bold hover:underline"
                          >
                            📌 Save to Timeline
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Interactive Clickable Suggestion Chips */}
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 max-w-3xl">
                        {m.suggestions.map((s, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => handleSendMessage(s)}
                            className="px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-900 font-semibold hover:bg-teal-100 hover:border-teal-300 transition-all text-xs text-left shadow-xs flex items-center gap-1.5 active:scale-95"
                          >
                            <span className="text-teal-700">💡</span>
                            <span>{s}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <span className="text-[10px] text-ink-400 mt-1 px-1">{m.timestamp}</span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 p-3 bg-white border border-ink-200 rounded-2xl rounded-bl-none w-28 shadow-xs">
                    <span className="text-xs text-ink-600 font-semibold">Thinking</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
              </div>
            </div>

            {/* Attached Image Preview */}
            {attachedImage && (
              <div className="px-4 py-1.5 bg-teal-50 border-t border-teal-200 flex items-center justify-between text-xs text-teal-900 shrink-0 max-w-4xl mx-auto w-full">
                <span className="font-semibold truncate">📷 Image attached for clinical inspection</span>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="text-red-700 font-bold hover:underline ml-2 shrink-0"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Pinned Input Dock with Quick Prompts Bar */}
            <div className="p-2.5 sm:p-3 bg-white border-t border-ink-200/80 shrink-0 space-y-1.5">
              <div className="max-w-4xl mx-auto space-y-1.5">
                {/* Horizontal Quick Prompt Chips Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {DEEP_CLINICAL_PROMPTS.map((sq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(sq.prompt)}
                      className="px-2.5 py-1 rounded-lg border border-ink-200/80 bg-ink-50/60 hover:bg-teal-50 hover:border-teal-300 transition-colors whitespace-nowrap text-[11px] font-bold text-ink-800 shrink-0"
                    >
                      {sq.title}
                    </button>
                  ))}
                </div>

                {/* Input Form with Microphone & Photo Attachment */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImagePick}
                  />

                  {/* Photo Attachment */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 px-3 rounded-xl border border-ink-200 text-ink-700 hover:bg-ink-100 transition-colors flex items-center gap-1 text-xs font-bold shrink-0 shadow-2xs"
                    title="Attach photo of medicine strip, prescription, or lab slip"
                  >
                    <span>📷</span>
                    <span className="hidden sm:inline">Attach</span>
                  </button>

                  {/* Voice Mic Button */}
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className={`h-10 px-3 rounded-xl border transition-all flex items-center gap-1 text-xs font-bold shrink-0 shadow-2xs ${
                      isRecording
                        ? 'bg-red-500 border-red-600 text-white animate-pulse'
                        : 'border-ink-200 text-ink-700 hover:bg-ink-100'
                    }`}
                    title={isRecording ? 'Listening... click to stop' : 'Speak to assistant in English or Urdu'}
                  >
                    <span>{isRecording ? '🎙️ Listening...' : '🎙️'}</span>
                    <span className="hidden sm:inline">{!isRecording && 'Speak'}</span>
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isRecording ? 'Listening to your voice...' : 'Ask about medications, timing, symptoms, or attach photos...'}
                    className="flex-1 h-10 px-3.5 text-xs sm:text-sm bg-ink-50 border border-ink-200 rounded-xl text-ink-900 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
                    disabled={isLoading}
                  />
                  <Button type="submit" variant="primary" size="sm" loading={isLoading} disabled={!input.trim() && !attachedImage} className="h-10 px-5 font-bold shrink-0 text-xs shadow-xs">
                    Send &rarr;
                  </Button>
                </form>

                <Disclaimer text={MEDICINE_INFO_DISCLAIMER} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Drug Interaction Radar */}
        {activeTab === 'radar' && (
          <div className="flex-1 overflow-y-auto min-h-0 pt-2 max-w-5xl mx-auto w-full">
            <DrugInteractionRadar
              medicines={activeMedsList}
              allergies={profile?.allergies ? String(profile.allergies) : null}
              chronicConditions={profile?.chronic_conditions ? String(profile.chronic_conditions) : null}
              onAskAssistant={(query) => handleSendMessage(query)}
            />
          </div>
        )}

        {/* Tab 3: Doctor Visit Prep Brief */}
        {activeTab === 'doctor-prep' && (
          <div className="flex-1 overflow-y-auto min-h-0 pt-2 max-w-5xl mx-auto w-full">
            <DoctorPrepBrief
              profile={profile}
              medicines={activeMedsList}
              visits={visits}
              reports={reports}
              sideEffects={sideEffects}
              onAskAssistant={(query) => handleSendMessage(query)}
            />
          </div>
        )}

        {/* Tab 4: Biomarker Trajectory */}
        {activeTab === 'biomarkers' && (
          <div className="flex-1 overflow-y-auto min-h-0 pt-2 max-w-5xl mx-auto w-full">
            <BiomarkerTrajectory
              reports={reports}
              resultsMap={resultsMap}
              onAskAssistant={(query) => handleSendMessage(query)}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

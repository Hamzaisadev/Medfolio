import { useState, useEffect, useRef, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Toast } from '../../components/ui/Toast';
import { Dialog } from '../../components/ui/Dialog';
import { Disclaimer } from '../../components/ui/Disclaimer';
import {
  MedicineIcon,
  BarChartIcon,
  DoctorIcon,
  ShieldIcon,
  FolderIcon,
  MessageSquareIcon,
  XIcon,
  AlertTriangleIcon,
  SparklesIcon,
} from '../../components/ui/icons';
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
import { useAuth } from '../../lib/auth/AuthContext';
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
    title: 'Check Drug Interactions',
    prompt: 'Check all my active medicines for potential interactions and food timing conflicts.',
  },
  {
    title: 'Analyze Lab Trends',
    prompt: 'Correlate my recent lab report results with my prescribed medicines.',
  },
  {
    title: 'Doctor Visit Prep Plan',
    prompt: 'Review advice from my last visit and give me follow-up questions for my next checkup.',
  },
  {
    title: 'Daily Meal & Dose Schedule',
    prompt: 'Generate an exact daily timetable showing what time to take each medicine relative to food.',
  },
];

const CHAT_STORAGE_KEY = 'medfolio_assistant_messages_v2';
const PERSISTED_MESSAGE_LIMIT = 50;

export function AssistantPage() {
  const { user, profile: authProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'radar' | 'doctor-prep' | 'biomarkers'>('chat');
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: Message) => ({ ...m, image_base64: null, image_mime: null }));
        }
      }
    } catch (err) {
      console.error('Failed to parse saved chat history:', err);
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Welcome to your Medfolio Clinical Health Assistant. I am specialized in managing your active prescriptions, dosage timings, and lab results. Ask any health question, review drug interactions, or upload prescription photos.',
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
        medicinesRepo.listMedicines(effectiveProfileId),
        visitsRepo.listVisits(effectiveProfileId),
        reportsRepo.listReports(effectiveProfileId),
        sideEffectsRepo.listSideEffects(effectiveProfileId),
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

  useEffect(() => {
    try {
      const persistable = messages.slice(-PERSISTED_MESSAGE_LIMIT).map((m) => ({
        ...m,
        image_base64: null,
        image_mime: null,
      }));
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(persistable));
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

  // Web Speech API
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

  return (
    <AppShell fullWidth noPadding fixedViewport>
      <div className="flex-1 flex flex-col h-full min-h-0 w-full">
        {/* Top Header Bar */}
        <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-line bg-surface-raised flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-content leading-tight">
                Clinical Health Assistant
              </h1>
              <p className="text-xs text-content-muted mt-0.5">
                Answers grounded in your active prescriptions, dosage routines, and lab records.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowContextDrawer(!showContextDrawer)}
              className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 ${
                showContextDrawer
                  ? 'bg-accent text-content-onaccent border-accent shadow-xs'
                  : 'bg-surface-sunken text-content-muted border-line hover:border-line-strong hover:text-content'
              }`}
            >
              <FolderIcon size={14} />
              <span>Patient Context ({activeMedsList.length} Active Meds)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSafetyModal(true)}
              className="px-3 py-1.5 rounded-xl border border-line bg-surface-sunken text-content-muted hover:bg-surface-hover text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Clinical oversight & safety"
            >
              <ShieldIcon size={13} />
              <span className="hidden sm:inline">Safety</span>
            </button>

            <Button
              variant="ghost"
              size="sm"
              className="py-1 px-3 text-xs h-8 text-content-muted hover:text-risk-text"
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
                } catch {
                  // ignore
                }
              }}
            >
              Clear Chat
            </Button>
          </div>
        </div>

        {/* Workspace Mode Tabs */}
        <div className="shrink-0 px-4 sm:px-6 py-2.5 bg-surface-raised/50 border-b border-line">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-5xl mx-auto">
            {[
              { id: 'chat', label: 'Consultation Chat', icon: <MessageSquareIcon size={15} /> },
              { id: 'radar', label: 'Drug Interactions', icon: <MedicineIcon size={15} /> },
              { id: 'doctor-prep', label: 'Doctor Visit Prep', icon: <DoctorIcon size={15} /> },
              { id: 'biomarkers', label: 'Biomarker Trends', icon: <BarChartIcon size={15} /> },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`py-2 px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
                    isActive
                      ? 'bg-accent text-content-onaccent shadow-xs'
                      : 'bg-surface-sunken text-content-muted hover:text-content hover:bg-surface-hover border border-line'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Toast
          open={Boolean(toastMessage)}
          onClose={() => setToastMessage(null)}
          message={toastMessage || ''}
          tone="ok"
        />

        {/* Collapsible Record Grounding Context Drawer */}
        {showContextDrawer && (
          <div className="shrink-0 p-4 sm:p-5 bg-surface-raised border-b border-line shadow-card animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="max-w-5xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-content">Patient Record Grounding</span>
                <button
                  type="button"
                  onClick={() => setShowContextDrawer(false)}
                  className="text-content-muted hover:text-content p-1 rounded-md"
                >
                  <XIcon size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 bg-surface-sunken rounded-xl border border-line">
                  <span className="text-content-subtle font-semibold block text-xs mb-1.5">
                    Active Medications ({activeMedsList.length})
                  </span>
                  {activeMedsList.length === 0 ? (
                    <p className="text-content-subtle italic text-xs">No active prescriptions.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {activeMedsList.map((m) => (
                        <Badge key={m.id} tone="neutral" size="sm">
                          {m.medicine_name} {m.strength || ''}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-surface-sunken rounded-xl border border-line">
                  <span className="text-content-subtle font-semibold block text-xs mb-1.5">
                    Allergies & Chronic Conditions
                  </span>
                  <p className="text-content font-medium text-xs">
                    {profile?.allergies ? String(profile.allergies) : 'None recorded'}
                  </p>
                  {profile?.chronic_conditions && (
                    <p className="text-content-muted text-xs mt-1">
                      {String(profile.chronic_conditions)}
                    </p>
                  )}
                </div>

                <div className="p-3.5 bg-surface-sunken rounded-xl border border-line">
                  <span className="text-content-subtle font-semibold block text-xs mb-1.5">
                    Recent Consultation & Labs
                  </span>
                  <p className="text-content font-medium text-xs truncate">
                    {visits[0] ? `Dr. ${visits[0].doctor_name || 'Physician'} (${visits[0].visit_date})` : 'No recorded visits'}
                  </p>
                  {reports[0] && (
                    <p className="text-accent text-xs mt-1 truncate font-medium">
                      {reports[0].title} ({reports[0].report_date})
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Spacious, Open Consultation Chat */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-surface-sunken">
            {/* Scrollable Messages Stream */}
            <div ref={chatContainerRef} className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6 text-sm sm:text-base">
              <div className="max-w-5xl mx-auto space-y-6">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`p-5 sm:p-6 rounded-2xl leading-relaxed transition-all ${
                        m.role === 'user'
                          ? 'bg-accent text-content-onaccent rounded-br-xs font-medium max-w-[80%] text-sm sm:text-base shadow-sm'
                          : 'bg-surface-raised border border-line text-content rounded-bl-xs w-full shadow-card text-sm sm:text-base space-y-4'
                      }`}
                    >
                      {m.image_base64 && (
                        <img
                          src={m.image_base64}
                          alt="User attachment"
                          className="w-full max-h-72 object-cover rounded-xl mb-4 border border-line shadow-xs"
                        />
                      )}
                      <p className="whitespace-pre-line leading-relaxed">{m.content}</p>

                      {/* Modular Interactive Widgets */}
                      {m.medicines && m.medicines.length > 0 && (
                        <div className="pt-2">
                          <EditablePrescriptionWidget
                            initialMedicines={m.medicines}
                            profileId={effectiveProfileId}
                            userId={effectiveUserId}
                            onAddedSuccess={(count) => {
                              setToastMessage(`Added ${count} medicines to your cabinet.`);
                              loadData();
                            }}
                          />
                        </div>
                      )}

                      {m.dailySchedule && m.dailySchedule.length > 0 && (
                        <div className="pt-2">
                          <DailyScheduleClockWidget slots={m.dailySchedule} />
                        </div>
                      )}

                      {m.diffAnalysis && m.diffAnalysis.length > 0 && (
                        <div className="pt-2">
                          <PrescriptionDiffWidget diffs={m.diffAnalysis} />
                        </div>
                      )}

                      {m.actionCall && (
                        <div className="pt-2">
                          <ClinicalActionCards
                            action={m.actionCall}
                            profileId={effectiveProfileId}
                            onExecuted={(msg) => {
                              setToastMessage(msg);
                              loadData();
                            }}
                          />
                        </div>
                      )}

                      {m.safetyAlerts && m.safetyAlerts.length > 0 && (
                        <div className="p-4 rounded-xl border border-warn-border bg-warn-bg text-sm space-y-1.5">
                          <span className="font-bold text-warn-text flex items-center gap-2 text-sm">
                            <AlertTriangleIcon size={16} className="shrink-0" /> Clinical Safety Alert:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-warn-text text-xs sm:text-sm">
                            {m.safetyAlerts.map((alert, aIdx) => (
                              <li key={aIdx}>{alert}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {m.role === 'assistant' && m.id !== 'welcome' && (
                        <div className="pt-3 border-t border-line flex items-center justify-between text-xs text-content-subtle">
                          <span>Grounded in patient health record</span>
                          <button
                            type="button"
                            onClick={() => handleToggleSpeak(m.id, m.content)}
                            className="text-accent hover:underline font-bold text-xs"
                          >
                            {speakingMsgId === m.id ? 'Stop audio' : 'Listen'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Clickable Follow-up Suggestions */}
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 max-w-4xl">
                        {m.suggestions.map((s, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => handleSendMessage(s)}
                            className="px-4 py-2 rounded-xl bg-surface-raised border border-line text-content font-medium hover:border-accent hover:text-accent transition-colors text-xs sm:text-sm text-left flex items-center gap-2 shadow-2xs"
                          >
                            <SparklesIcon size={14} className="text-accent shrink-0" />
                            <span>{s}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <span className="text-2xs text-content-subtle mt-1.5 px-2">{m.timestamp}</span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-3 p-4 bg-surface-raised border border-line rounded-2xl max-w-sm text-sm text-content-muted font-medium shadow-card">
                    <span>Analyzing clinical records</span>
                    <div className="w-2 h-2 rounded-full bg-accent animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
              </div>
            </div>

            {/* Attached Photo Preview */}
            {attachedImage && (
              <div className="px-6 py-2.5 bg-accent-subtle border-t border-line flex items-center justify-between text-xs sm:text-sm text-content shrink-0 max-w-5xl mx-auto w-full">
                <span className="font-semibold truncate flex items-center gap-2">
                  <FolderIcon size={16} className="text-accent shrink-0" /> Photo attached for clinical review
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="text-risk-text font-bold hover:underline ml-3 shrink-0"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Expansive Input Dock */}
            <div className="p-4 sm:p-5 bg-surface-raised border-t border-line shrink-0">
              <div className="max-w-5xl mx-auto space-y-3">
                {/* Horizontal Quick Prompt Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {DEEP_CLINICAL_PROMPTS.map((sq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(sq.prompt)}
                      className="px-3.5 py-1.5 rounded-xl border border-line bg-surface-sunken hover:bg-surface-hover hover:border-line-strong transition-colors whitespace-nowrap text-xs font-semibold text-content-muted hover:text-content shrink-0"
                    >
                      {sq.title}
                    </button>
                  ))}
                </div>

                {/* Input Form with Large Targets */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2.5"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImagePick}
                    aria-label="Attach prescription or lab slip"
                  />

                  {/* Photo Attachment */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach photo"
                    className="h-12 px-3.5 rounded-xl border border-line bg-surface-sunken text-content-muted hover:text-content hover:bg-surface-hover transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-semibold shrink-0"
                    title="Attach photo of prescription or medicine strip"
                  >
                    <FolderIcon size={17} />
                    <span className="hidden sm:inline">Attach</span>
                  </button>

                  {/* Voice Mic Button */}
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}
                    className={`h-12 px-3.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs sm:text-sm font-semibold shrink-0 ${
                      isRecording
                        ? 'bg-warn-bg border-warn-border text-warn-text animate-pulse'
                        : 'border-line bg-surface-sunken text-content-muted hover:text-content hover:bg-surface-hover'
                    }`}
                    title={isRecording ? 'Listening... click to stop' : 'Dictate with voice'}
                  >
                    <span>{isRecording ? 'Listening...' : 'Voice'}</span>
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isRecording ? 'Listening...' : 'Ask about medications, dosage timing, lab tests, or attach photos...'}
                    aria-label="Message the assistant"
                    className="flex-1 h-12 px-4 text-base sm:text-sm bg-surface-sunken border border-line rounded-xl text-content placeholder:text-content-subtle focus:outline-none focus:ring-2 focus:ring-accent"
                    disabled={isLoading}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={isLoading}
                    disabled={!input.trim() && !attachedImage}
                    className="h-12 px-6 font-bold shrink-0 text-sm shadow-xs"
                  >
                    Send
                  </Button>
                </form>

                <Disclaimer text={MEDICINE_INFO_DISCLAIMER} />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Drug Interaction Radar */}
        {activeTab === 'radar' && (
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
            <DrugInteractionRadar
              medicines={activeMedsList}
              allergies={profile?.allergies ? String(profile.allergies) : undefined}
              chronicConditions={profile?.chronic_conditions ? String(profile.chronic_conditions) : undefined}
              onAskAssistant={(query) => handleSendMessage(query)}
            />
          </div>
        )}

        {/* Tab 3: Doctor Visit Prep Brief */}
        {activeTab === 'doctor-prep' && (
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
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

        {/* Tab 4: Biomarker Trajectory Analytics */}
        {activeTab === 'biomarkers' && (
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
            <BiomarkerTrajectory
              reports={reports}
              resultsMap={resultsMap}
              onAskAssistant={(query) => handleSendMessage(query)}
            />
          </div>
        )}

        {/* Safety & Clinical Oversight Modal */}
        <Dialog
          open={showSafetyModal}
          onOpenChange={setShowSafetyModal}
          title="Clinical Safety & Oversight"
          description="Guidelines governing Medfolio's health assistant."
        >
          <div className="space-y-4 text-xs sm:text-sm text-content-muted leading-relaxed">
            <p>
              Medfolio's health assistant assists you in understanding prescriptions, organizing daily dose schedules, and reviewing lab results.
            </p>
            <div className="p-4 bg-surface-sunken border border-line rounded-xl space-y-1.5">
              <span className="font-bold text-content block text-xs sm:text-sm">Core Principles:</span>
              <ul className="list-disc list-inside space-y-1 text-xs text-content-muted">
                <li>Grounds responses strictly on your uploaded prescriptions and reports.</li>
                <li>Highlights dangerous drug-drug combinations and allergy risks.</li>
                <li>Never replaces professional medical diagnosis, advice, or emergency triage.</li>
              </ul>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setShowSafetyModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}

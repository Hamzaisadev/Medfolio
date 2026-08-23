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
  CheckIcon,
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
    title: 'Drug Interaction Check',
    prompt: 'Check all my active medicines for potential interactions and food timing conflicts.',
  },
  {
    title: 'Synthesize Lab Trends',
    prompt: 'Correlate my recent lab report results with my prescribed medicines.',
  },
  {
    title: 'Doctor Action Plan',
    prompt: 'Review advice from my last visit and give me follow-up questions for my next checkup.',
  },
  {
    title: 'Daily Meal & Dose Timetable',
    prompt: 'Generate an exact daily timetable showing what time to take each medicine relative to food.',
  },
];

const CHAT_STORAGE_KEY = 'medfolio_assistant_messages_v2';
// History kept in localStorage is capped and never includes photo attachments.
const PERSISTED_MESSAGE_LIMIT = 50;

export function AssistantPage() {
  const { user, profile: authProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'radar' | 'doctor-prep' | 'biomarkers'>('chat');
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  // Persist messages in localStorage across page refreshes
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Older builds persisted photo attachments; drop them on read.
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

  // Save messages to localStorage whenever they change. Photos are never
  // persisted: base64 attachments are megabytes of clinical imagery sitting
  // unencrypted in browser storage, so they stay in memory for the session only.
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

  return (
    <AppShell fullWidth noPadding fixedViewport>
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden w-full">
        {/* Top Header & Tab Controls */}
        <div className="shrink-0 pb-2 pt-1 border-b border-line bg-surface-raised/90 px-3 sm:px-4 rounded-xl mb-1.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-black text-content leading-tight">Clinical Health Assistant</h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSafetyModal(true)}
                className="px-2.5 py-1 rounded-lg border border-line bg-surface-raised text-content-muted hover:bg-surface-hover text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                title="View safety and reliability information"
              >
                <ShieldIcon size={14} />
                <span className="hidden sm:inline">Safety & Oversight</span>
                <span className="sm:hidden">Safety</span>
              </button>

              <button
                type="button"
                onClick={() => setShowContextDrawer(!showContextDrawer)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  showContextDrawer
                    ? 'bg-accent text-content-onaccent border-accent shadow-2xs'
                    : 'bg-surface-raised text-content-muted border-line hover:bg-surface-hover'
                }`}
              >
                <FolderIcon size={14} />
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
          <div className="flex items-center gap-1 p-1 bg-surface-sunken/80 border border-line rounded-xl mt-1.5 max-w-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap tap-spring flex items-center justify-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-surface-raised text-accent font-black shadow-xs border border-line'
                  : 'text-content-muted hover:text-content hover:bg-surface-hover'
              }`}
            >
              <MessageSquareIcon size={14} />
              <span>Consultation Chat</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('radar')}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap tap-spring flex items-center justify-center gap-1.5 ${
                activeTab === 'radar'
                  ? 'bg-surface-raised text-accent font-black shadow-xs border border-line'
                  : 'text-content-muted hover:text-content hover:bg-surface-hover'
              }`}
            >
              <MedicineIcon size={14} />
              <span>Interaction Radar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('doctor-prep')}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap tap-spring flex items-center justify-center gap-1.5 ${
                activeTab === 'doctor-prep'
                  ? 'bg-surface-raised text-accent font-black shadow-xs border border-line'
                  : 'text-content-muted hover:text-content hover:bg-surface-hover'
              }`}
            >
              <DoctorIcon size={14} />
              <span>Doctor Visit Prep</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('biomarkers')}
              className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all whitespace-nowrap tap-spring flex items-center justify-center gap-1.5 ${
                activeTab === 'biomarkers'
                  ? 'bg-surface-raised text-accent font-black shadow-xs border border-line'
                  : 'text-content-muted hover:text-content hover:bg-surface-hover'
              }`}
            >
              <BarChartIcon size={14} />
              <span>Biomarker Trends</span>
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
          <div className="shrink-0 mb-2 p-3 bg-surface-raised border border-line rounded-2xl shadow-card animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-content">Patient Record Context Grounding</span>
              <button
                type="button"
                onClick={() => setShowContextDrawer(false)}
                className="text-content-muted hover:text-content p-1"
              >
                <XIcon size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-surface-sunken rounded-lg">
                <span className="text-content-subtle font-semibold block text-2xs mb-0.5">Active Medications ({activeMedsList.length})</span>
                {activeMedsList.length === 0 ? (
                  <p className="text-content-subtle italic text-2xs">No active prescriptions.</p>
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

              <div className="p-2 bg-surface-sunken rounded-lg">
                <span className="text-content-subtle font-semibold block text-2xs mb-0.5">Allergies & Conditions</span>
                <p className="text-content font-medium text-2xs">
                  {profile?.allergies ? String(profile.allergies) : 'None recorded'}
                </p>
              </div>

              <div className="p-2 bg-surface-sunken rounded-lg">
                <span className="text-content-subtle font-semibold block text-2xs mb-0.5">Latest Consultation & Labs</span>
                <p className="text-content font-medium text-2xs truncate">
                  {visits[0] ? `Dr. ${visits[0].doctor_name || 'Physician'} (${visits[0].visit_date})` : 'No recent visits'}
                </p>
                {reports[0] && (
                  <p className="text-accent text-2xs mt-0.5 truncate">{reports[0].title} ({reports[0].report_date})</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Full-Height Single Internal Scroll Chat */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col bg-surface-raised/80 backdrop-blur-md border border-line rounded-2xl shadow-card overflow-hidden min-h-0">
            {/* Scrollable Messages Feed — THE ONLY SCROLLBAR */}
            <div ref={chatContainerRef} className="flex-1 p-3 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`p-4 sm:p-5 rounded-2xl leading-relaxed shadow-card transition-all ${
                        m.role === 'user'
                          ? 'bg-accent text-content-onaccent rounded-br-xs font-medium max-w-[85%] text-sm'
                          : 'bg-surface-raised/95 backdrop-blur-md border border-line text-content rounded-bl-xs w-full max-w-3xl text-xs sm:text-sm'
                      }`}
                    >
                      {m.image_base64 && (
                        <img
                          src={m.image_base64}
                          alt="User attachment"
                          className="w-full max-h-64 object-cover rounded-xl mb-3 border border-line shadow-xs"
                        />
                      )}
                      <p className="whitespace-pre-line leading-relaxed font-normal">{m.content}</p>

                      {/* 1. Interactive Editable Medicine Table if prescribed medicines were detected */}
                      {m.medicines && m.medicines.length > 0 && (
                        <EditablePrescriptionWidget
                          initialMedicines={m.medicines}
                          profileId={effectiveProfileId}
                          userId={effectiveUserId}
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
                        <div className="mt-3 p-3 rounded-xl border border-warn-border bg-warn-bg text-xs space-y-1">
                          <span className="font-bold text-warn-text flex items-center gap-1.5 text-xs">
                            <AlertTriangleIcon size={14} className="text-amber-700 shrink-0" /> Critical Safety Radar:
                          </span>
                          <ul className="list-disc list-inside space-y-0.5 text-warn-text text-xs">
                            {m.safetyAlerts.map((alert, aIdx) => (
                              <li key={aIdx}>{alert}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {m.role === 'assistant' && m.id !== 'welcome' && (
                        <div className="mt-3 pt-2 border-t border-line flex items-center justify-between text-xs text-content-subtle">
                          <div className="flex items-center gap-3">
                            <span>Based on your saved records</span>
                            <button
                              type="button"
                              onClick={() => handleToggleSpeak(m.id, m.content)}
                              className="text-content-muted hover:text-content font-bold flex items-center gap-1"
                              title="Listen to audio response"
                            >
                              <span>{speakingMsgId === m.id ? 'Stop Audio' : 'Listen'}</span>
                            </button>
                          </div>
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
                            className="px-3 py-1.5 rounded-full bg-accent-subtle border border-line text-accent font-semibold hover:bg-surface-hover transition-all text-xs text-left shadow-xs flex items-center gap-1.5 active:scale-95"
                          >
                            <SparklesIcon size={12} className="text-accent shrink-0" />
                            <span>{s}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <span className="text-2xs text-content-subtle mt-1 px-1">{m.timestamp}</span>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 p-3 bg-surface-raised border border-line rounded-2xl rounded-bl-none shadow-xs">
                    <span className="text-xs text-content-muted font-semibold">Checking your records</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
              </div>
            </div>

            {/* Attached Image Preview */}
            {attachedImage && (
              <div className="px-4 py-1.5 bg-accent-subtle border-t border-line flex items-center justify-between text-xs text-content shrink-0 max-w-4xl mx-auto w-full">
                <span className="font-semibold truncate flex items-center gap-1.5">
                  <FolderIcon size={14} className="text-accent" /> Image attached for clinical inspection
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="text-risk-text font-bold hover:underline ml-2 shrink-0"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Pinned Input Dock with Quick Prompts Bar */}
            <div className="p-2.5 sm:p-3 bg-surface-raised border-t border-line shrink-0 space-y-1.5">
              <div className="max-w-4xl mx-auto space-y-1.5">
                {/* Horizontal Quick Prompt Chips Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                  {DEEP_CLINICAL_PROMPTS.map((sq, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(sq.prompt)}
                      className="px-2.5 py-1 rounded-lg border border-line bg-surface-sunken/60 hover:bg-accent-subtle transition-colors whitespace-nowrap text-2xs font-bold text-content shrink-0"
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
                    aria-label="Attach a photo"
                  />

                  {/* Photo Attachment */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach photo of medicine strip, prescription, or lab slip"
                    className="h-11 px-3 rounded-xl border border-line text-content-muted hover:bg-surface-hover transition-colors flex items-center gap-1.5 text-xs font-bold shrink-0 shadow-2xs"
                    title="Attach photo of medicine strip, prescription, or lab slip"
                  >
                    <FolderIcon size={16} />
                    <span className="hidden sm:inline">Attach</span>
                  </button>

                  {/* Voice Mic Button */}
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}
                    className={`h-11 px-3 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 shadow-2xs ${
                      isRecording
                        ? 'bg-warn-bg border-warn-border text-warn-text animate-pulse'
                        : 'border-line text-content-muted hover:bg-surface-hover'
                    }`}
                    title={isRecording ? 'Listening... click to stop' : 'Voice input'}
                  >
                    <span>{isRecording ? 'Listening...' : 'Voice'}</span>
                  </button>

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={isRecording ? 'Listening to your voice...' : 'Ask about medications, timing, symptoms, or attach photos...'}
                    aria-label="Message the assistant"
                    className="flex-1 h-11 px-3.5 text-base sm:text-sm bg-surface-sunken border border-line rounded-xl text-content focus:outline-none focus:ring-2 focus:ring-accent shadow-2xs"
                    disabled={isLoading}
                  />
                  <Button type="submit" variant="primary" size="sm" loading={isLoading} disabled={!input.trim() && !attachedImage} className="h-11 px-5 font-bold shrink-0 text-xs shadow-xs">
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

        {/* Safety & human-oversight modal */}
        <Dialog
          open={showSafetyModal}
          onOpenChange={setShowSafetyModal}
          title="Safety, Reliability & Human Oversight"
          description="How Medfolio keeps every suggestion safe, grounded in your records, and confirmed by you."
          className="max-w-xl"
        >
          <div className="space-y-4 pt-2 text-xs text-content-muted">
            {/* Core Principle Banner */}
            <div className="p-3.5 rounded-2xl bg-accent-subtle border border-line">
              <span className="text-2xs font-black uppercase tracking-wider text-accent block mb-1">
                Winning Signal Principle
              </span>
              <p className="text-xs font-bold text-content leading-relaxed">
                The solution improves a care decision without pretending to replace care.
              </p>
            </div>

            {/* Human in the loop 4 steps */}
            <div className="border border-line rounded-2xl p-3.5 bg-surface-sunken/60">
              <span className="text-2xs font-black uppercase tracking-wider text-content-subtle block mb-2.5">
                Human-in-the-Loop Workflow
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl bg-surface-raised border border-line">
                  <p className="font-bold text-content text-2xs">1. Care Moment</p>
                  <p className="text-2xs text-content-subtle mt-0.5">Patient or caregiver logs symptoms, vitals, or prescription</p>
                </div>
                <div className="p-2 rounded-xl bg-surface-raised border border-line">
                  <p className="font-bold text-accent text-2xs">2. Assistant Support</p>
                  <p className="text-2xs text-content-subtle mt-0.5">Grounded extraction, dosage timetable & interaction checks</p>
                </div>
                <div className="p-2 rounded-xl bg-accent text-content-onaccent border border-accent">
                  <p className="font-bold text-2xs">3. Human Review</p>
                  <p className="text-2xs mt-0.5 opacity-80">Patient confirms all data; doctor oversight for clinical judgment</p>
                </div>
                <div className="p-2 rounded-xl bg-surface-raised border border-ok-border">
                  <p className="font-bold text-ok-text text-2xs">4. Next Action</p>
                  <p className="text-2xs text-content-subtle mt-0.5">Clear, verified schedule & checkup preparation notes</p>
                </div>
              </div>
            </div>

            {/* Safety Rules */}
            <div className="space-y-2 text-2xs">
              <div className="flex items-start gap-2">
                <CheckIcon size={14} className="text-ok-text shrink-0 mt-0.5" />
                <p><strong>Assist — Do Not Diagnose:</strong> The assistant helps organize regimens, explains terminology, and detects drug interactions, but never makes unilateral diagnostic claims.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckIcon size={14} className="text-ok-text shrink-0 mt-0.5" />
                <p><strong>Zero Silent Commits:</strong> No medical records, prescriptions, or schedule updates are saved without your explicit confirmation.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckIcon size={14} className="text-ok-text shrink-0 mt-0.5" />
                <p><strong>Domain Isolation:</strong> Responses are bounded strictly to personal health and pharmacology, refusing off-topic generation.</p>
              </div>
            </div>

            {/* Emergency Hotlines */}
            <div className="p-3 rounded-xl bg-risk-bg border border-risk-border flex items-center justify-between">
              <div>
                <p className="font-bold text-risk-text text-xs">Medical Emergency?</p>
                <p className="text-2xs text-risk-text">Dial immediately for acute care in Pakistan</p>
              </div>
              <div className="flex gap-1.5">
                <a href="tel:1122" className="px-2.5 py-1 rounded-lg border border-risk-border bg-surface-raised text-risk-text font-bold text-xs hover:bg-risk-bg">1122</a>
                <a href="tel:115" className="px-2.5 py-1 rounded-lg border border-risk-border bg-surface-raised text-risk-text font-bold text-xs hover:bg-risk-bg">115</a>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button size="sm" variant="primary" onClick={() => setShowSafetyModal(false)}>
                Understood
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Toast } from '../../components/ui/Toast';
import { Dialog } from '../../components/ui/Dialog';
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
  MicrophoneIcon,
  TrashIcon,
  SendIcon,
  Volume2Icon,
  CopyIcon,
  CheckIcon,
} from '../../components/ui/icons';
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
  citations?: Array<{
    source: string;
    type: string;
    detail: string;
  }>;
  sentinelAlerts?: Array<{
    type: string;
    severity: 'critical' | 'high' | 'moderate';
    genericName: string;
    drugClass: string;
    involvedBrands: string[];
    clinicalMessage: string;
    actionRecommendation: string;
  }>;
  biomarkerTrajectories?: Array<{
    displayName: string;
    unit: string;
    deltaValue: number;
    deltaPercent: number;
    trendStatus: 'worsening' | 'improving' | 'stable' | 'fluctuating';
    clinicalSignificance: string;
    predictiveAlert?: string;
  }>;
}

const DEEP_CLINICAL_PROMPTS = [
  {
    title: 'Check Drug Interactions',
    prompt: 'Check all my active medicines for potential interactions and food timing conflicts.',
    icon: <MedicineIcon size={14} />,
  },
  {
    title: 'Analyze Lab Trends',
    prompt: 'Correlate my recent lab report results with my prescribed medicines.',
    icon: <BarChartIcon size={14} />,
  },
  {
    title: 'Doctor Visit Prep Plan',
    prompt: 'Review advice from my last visit and give me follow-up questions for my next checkup.',
    icon: <DoctorIcon size={14} />,
  },
  {
    title: 'Daily Meal & Dose Schedule',
    prompt: 'Generate an exact daily timetable showing what time to take each medicine relative to food.',
    icon: <MessageSquareIcon size={14} />,
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
        content: 'Welcome to your Clinical Health Assistant. I am specialized in managing your active prescriptions, dosage timings, and lab results. Ask health questions, check drug interactions, or upload prescription photos.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mime: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleCopyMessage = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      // ignore
    }
  };

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

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Preload synthesis voices on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        window.speechSynthesis.cancel();
      };
    }
  }, []);

  // Web Speech API - Voice Recognition
  const toggleSpeechRecognition = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToastMessage('Voice dictation is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isRecording) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (recognitionRef.current as any)?.stop();
      } catch {
        // ignore
      }
      setIsRecording(false);
      return;
    }

    try {
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        setIsRecording(false);
        if (event.error === 'not-allowed') {
          setToastMessage('Microphone access was denied. Please allow mic permissions.');
        } else if (event.error === 'network') {
          setToastMessage('Speech network error. If using Brave, enable Google Speech in settings.');
        } else {
          setToastMessage(`Voice input error: ${event.error || 'Check microphone'}`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (err: unknown) {
      setIsRecording(false);
      setToastMessage('Could not start voice recognition. Please check permissions.');
    }
  };

  // Text-To-Speech Playback
  const handleToggleSpeak = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setToastMessage('Audio playback not supported in this browser.');
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      utteranceRef.current = null;
      return;
    }

    // Cancel any previous utterance
    window.speechSynthesis.cancel();

    // Clean markdown and formatting characters for natural speech
    const cleanText = text
      .replace(/[#*_`~>-]/g, ' ')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utteranceRef.current = utterance;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.default)) ||
      voices.find((v) => v.lang.startsWith('en'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setSpeakingMsgId(msgId);
    };

    utterance.onend = () => {
      setSpeakingMsgId(null);
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setSpeakingMsgId(null);
      utteranceRef.current = null;
    };

    // Ensure audio isn't in a paused state in Chromium
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

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

  const handleClearChat = () => {
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
      const reportsWithResults = reports.map((r) => {
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
        recentVisits: visits.map((v) => ({
          doctor_name: v.doctor_name,
          visit_date: v.visit_date,
          diagnosis: v.diagnosis,
          doctor_advice: v.doctor_advice,
        })),
        recentReports: reportsWithResults,
        sideEffectsHistory: sideEffects.map((s) => ({
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
        citations?: Array<{ source: string; type: string; detail: string }>;
        sentinelAlerts?: Array<{
          type: string;
          severity: 'critical' | 'high' | 'moderate';
          genericName: string;
          drugClass: string;
          involvedBrands: string[];
          clinicalMessage: string;
          actionRecommendation: string;
        }>;
        biomarkerTrajectories?: Array<{
          displayName: string;
          unit: string;
          deltaValue: number;
          deltaPercent: number;
          trendStatus: 'worsening' | 'improving' | 'stable' | 'fluctuating';
          clinicalSignificance: string;
          predictiveAlert?: string;
        }>;
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
        citations: data.citations || [],
        sentinelAlerts: data.sentinelAlerts || [],
        biomarkerTrajectories: data.biomarkerTrajectories || [],
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
      <div className="flex-1 flex flex-col h-full min-h-0 w-full bg-surface-sunken">
        {/* Streamlined Single-Line Header Bar */}
        <div className="shrink-0 border-b border-line bg-surface-raised shadow-2xs z-10 px-3 sm:px-4">
          <div className="max-w-4xl mx-auto h-12 flex items-center justify-between gap-2">
            {/* Left: Title & Record Badge */}
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-bold text-sm sm:text-base text-content">
                Health Assistant
              </span>
              <button
                type="button"
                onClick={() => setShowContextDrawer(!showContextDrawer)}
                className={`text-2xs font-semibold px-2 py-0.5 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                  showContextDrawer
                    ? 'bg-accent text-content-onaccent border-accent shadow-xs'
                    : 'bg-surface-sunken text-content-muted border-line hover:border-line-strong hover:text-content'
                }`}
                title="Click to view active health context"
              >
                <FolderIcon size={12} />
                <span>{activeMedsList.length} Active Med{activeMedsList.length === 1 ? '' : 's'}</span>
              </button>
            </div>

            {/* Center: Sleek Segmented Mode Tabs */}
            <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-xl border border-line">
              {[
                { id: 'chat', label: 'Chat', icon: <MessageSquareIcon size={13} /> },
                { id: 'radar', label: 'Interactions', icon: <MedicineIcon size={13} /> },
                { id: 'doctor-prep', label: 'Doctor Prep', icon: <DoctorIcon size={13} /> },
                { id: 'biomarkers', label: 'Lab Trends', icon: <BarChartIcon size={13} /> },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-surface-raised text-accent shadow-xs border border-line'
                        : 'text-content-muted hover:text-content'
                    }`}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowSafetyModal(true)}
                className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-surface-hover transition-colors cursor-pointer"
                title="Clinical safety & oversight"
              >
                <ShieldIcon size={15} />
              </button>
              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 rounded-lg text-content-muted hover:text-risk-text hover:bg-risk-bg transition-colors cursor-pointer"
                title="Clear conversation"
              >
                <TrashIcon size={15} />
              </button>
            </div>
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
          <div className="shrink-0 p-4 bg-surface-raised border-b border-line shadow-card animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="max-w-4xl mx-auto space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-content">Patient Record Grounding</span>
                <button
                  type="button"
                  onClick={() => setShowContextDrawer(false)}
                  className="text-content-muted hover:text-content p-1 rounded-md"
                >
                  <XIcon size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 bg-surface-sunken rounded-xl border border-line">
                  <span className="text-content-subtle font-semibold block text-2xs mb-1">
                    Active Medications ({activeMedsList.length})
                  </span>
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

                <div className="p-2.5 bg-surface-sunken rounded-xl border border-line">
                  <span className="text-content-subtle font-semibold block text-2xs mb-1">
                    Allergies & Conditions
                  </span>
                  <p className="text-content font-medium text-2xs">
                    {profile?.allergies ? String(profile.allergies) : 'None recorded'}
                  </p>
                  {profile?.chronic_conditions && (
                    <p className="text-content-muted text-2xs mt-0.5">
                      {String(profile.chronic_conditions)}
                    </p>
                  )}
                </div>

                <div className="p-2.5 bg-surface-sunken rounded-xl border border-line">
                  <span className="text-content-subtle font-semibold block text-2xs mb-1">
                    Recent Consultation & Labs
                  </span>
                  <p className="text-content font-medium text-2xs truncate">
                    {visits[0] ? `Dr. ${visits[0].doctor_name || 'Physician'} (${visits[0].visit_date})` : 'No recorded visits'}
                  </p>
                  {reports[0] && (
                    <p className="text-accent text-2xs mt-0.5 truncate font-medium">
                      {reports[0].title} ({reports[0].report_date})
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Full-Height Clean Consultation Chat */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-surface-sunken/40">
            {/* Scrollable Messages Stream */}
            <div ref={chatContainerRef} className="flex-1 p-3 sm:p-5 lg:p-6 overflow-y-auto space-y-6 text-sm sm:text-base">
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.map((m) => {
                  const userInitial =
                    authProfile?.full_name?.charAt(0).toUpperCase() ||
                    user?.email?.charAt(0).toUpperCase() ||
                    'U';

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col w-full ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      {m.role === 'assistant' ? (
                        <div className="flex flex-col items-start w-full space-y-2">
                          {/* Assistant Identity Bar */}
                          <div className="flex items-center justify-between w-full px-1">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shadow-2xs">
                                <SparklesIcon size={14} />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs sm:text-sm text-content">Medfolio AI</span>
                                <span className="px-1.5 py-0.5 rounded-md bg-accent/10 text-accent font-bold text-[10px] uppercase tracking-wider">
                                  Clinical Copilot
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 text-content-subtle">
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(m.id, m.content)}
                                className="p-1.5 rounded-lg hover:text-content hover:bg-surface-hover transition-colors text-xs flex items-center gap-1 cursor-pointer"
                                title="Copy response"
                              >
                                {copiedMsgId === m.id ? (
                                  <>
                                    <CheckIcon size={13} className="text-ok-text" />
                                    <span className="text-[11px] text-ok-text font-bold">Copied</span>
                                  </>
                                ) : (
                                  <CopyIcon size={13} />
                                )}
                              </button>
                              {m.id !== 'welcome' && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleSpeak(m.id, m.content)}
                                  className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 cursor-pointer ${
                                    speakingMsgId === m.id
                                      ? 'text-accent bg-accent/10 font-bold'
                                      : 'hover:text-content hover:bg-surface-hover'
                                  }`}
                                  title={speakingMsgId === m.id ? 'Stop audio' : 'Listen to response'}
                                >
                                  <Volume2Icon size={13} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Assistant Message Bubble */}
                          <div className="w-full bg-surface-raised border border-line-strong rounded-2xl rounded-tl-xs p-4 sm:p-5 text-content shadow-card text-sm sm:text-base space-y-3.5 leading-relaxed">
                            {m.image_base64 && (
                              <img
                                src={m.image_base64}
                                alt="User attachment"
                                className="w-full max-h-72 object-cover rounded-xl border border-line shadow-xs"
                              />
                            )}
                            <p className="whitespace-pre-line leading-relaxed text-content">{m.content}</p>

                            {/* Modular Interactive Widgets */}
                            {m.medicines && m.medicines.length > 0 && (
                              <div className="pt-1">
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
                              <div className="pt-1">
                                <DailyScheduleClockWidget slots={m.dailySchedule} />
                              </div>
                            )}

                            {m.diffAnalysis && m.diffAnalysis.length > 0 && (
                              <div className="pt-1">
                                <PrescriptionDiffWidget diffs={m.diffAnalysis} />
                              </div>
                            )}

                            {m.actionCall && (
                              <div className="pt-1">
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

                            {/* Clinical Safety Sentinel (Duplicate / Overdose Alerts) */}
                            {m.sentinelAlerts && m.sentinelAlerts.length > 0 && (
                              <div className="space-y-2 pt-1">
                                {m.sentinelAlerts.map((sentinel, sIdx) => {
                                  const isCritical = sentinel.severity === 'critical';
                                  return (
                                    <div
                                      key={sIdx}
                                      className={`p-3.5 rounded-xl border text-xs sm:text-sm space-y-1.5 shadow-2xs ${
                                        isCritical
                                          ? 'border-risk-border bg-risk-bg text-risk-text'
                                          : 'border-warn-border bg-warn-bg text-warn-text'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between font-bold">
                                        <span className="flex items-center gap-1.5">
                                          <AlertTriangleIcon size={16} className="shrink-0" />
                                          <span>
                                            {sentinel.type === 'cumulative_overdose'
                                              ? 'Cumulative Overdose Sentinel Alert'
                                              : sentinel.type === 'duplicate_generic'
                                              ? 'Duplicate Active Ingredient Alert'
                                              : 'Therapeutic Class Overlap Alert'}
                                          </span>
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded-full text-2xs uppercase tracking-wider font-extrabold ${
                                            isCritical
                                              ? 'bg-risk-fill text-content-onaccent'
                                              : 'bg-warn-border text-content'
                                          }`}
                                        >
                                          {sentinel.severity}
                                        </span>
                                      </div>
                                      <p className="font-semibold text-xs">{sentinel.clinicalMessage}</p>
                                      <div className="flex items-center gap-1.5 text-2xs pt-0.5 opacity-90">
                                        <span className="font-bold">Action:</span>
                                        <span>{sentinel.actionRecommendation}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Longitudinal Biomarker Trajectory & Predictive Anomaly Insights */}
                            {m.biomarkerTrajectories && m.biomarkerTrajectories.length > 0 && (
                              <div className="space-y-2 pt-1">
                                {m.biomarkerTrajectories.map((traj, tIdx) => {
                                  const isWorse = traj.trendStatus === 'worsening';
                                  return (
                                    <div
                                      key={tIdx}
                                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 shadow-2xs ${
                                        traj.predictiveAlert
                                          ? isWorse
                                            ? 'border-risk-border bg-risk-bg text-risk-text'
                                            : 'border-warn-border bg-warn-bg text-warn-text'
                                          : 'border-line bg-surface-sunken/80 text-content'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between font-bold">
                                        <span className="flex items-center gap-1.5">
                                          <BarChartIcon size={16} className="text-accent shrink-0" />
                                          <span>Biomarker Trajectory: {traj.displayName}</span>
                                        </span>
                                        <Badge
                                          tone={traj.trendStatus === 'worsening' ? 'risk' : traj.trendStatus === 'improving' ? 'ok' : 'neutral'}
                                          size="sm"
                                        >
                                          {traj.deltaPercent >= 0 ? '+' : ''}{traj.deltaPercent.toFixed(0)}% ({traj.trendStatus})
                                        </Badge>
                                      </div>
                                      <p className="text-xs leading-relaxed">{traj.clinicalSignificance}</p>
                                      {traj.predictiveAlert && (
                                        <div className="p-2 rounded-lg bg-surface-raised border border-line text-2xs font-semibold flex items-center gap-1.5">
                                          <AlertTriangleIcon size={14} className="text-warn-text shrink-0" />
                                          <span>{traj.predictiveAlert}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {m.safetyAlerts && m.safetyAlerts.length > 0 && (
                              <div className="p-3.5 rounded-xl border border-warn-border bg-warn-bg text-sm space-y-1">
                                <span className="font-bold text-warn-text flex items-center gap-2 text-xs sm:text-sm">
                                  <AlertTriangleIcon size={15} className="shrink-0" /> Clinical Safety Alert:
                                </span>
                                <ul className="list-disc list-inside space-y-0.5 text-warn-text text-xs sm:text-sm">
                                  {m.safetyAlerts.map((alert, aIdx) => (
                                    <li key={aIdx}>{alert}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Retrieved Clinical Evidence & Grounding Citations */}
                            {m.citations && m.citations.length > 0 && (
                              <div className="pt-1">
                                <div className="p-2.5 rounded-xl bg-surface-sunken/80 border border-line text-2xs space-y-1.5">
                                  <span className="font-bold text-accent flex items-center gap-1.5">
                                    <FolderIcon size={12} className="shrink-0" />
                                    <span>Grounded in {m.citations.length} Verified Clinical & Record Source{m.citations.length > 1 ? 's' : ''}:</span>
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {m.citations.map((c, cIdx) => (
                                      <span
                                        key={cIdx}
                                        className="px-2 py-0.5 rounded-md bg-surface-raised border border-line text-content-muted font-medium text-2xs shadow-2xs"
                                        title={c.detail}
                                      >
                                        {c.source}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          <span className="text-[11px] text-content-subtle px-1">{m.timestamp}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end space-y-1.5 max-w-[85%] sm:max-w-[75%]">
                          <div className="flex items-center gap-1.5 px-1">
                            <span className="font-bold text-xs text-content-muted">You</span>
                            <div className="w-5 h-5 rounded-full bg-surface-raised border border-line flex items-center justify-center text-[10px] font-bold text-content shadow-2xs">
                              {userInitial}
                            </div>
                          </div>

                          <div className="bg-accent text-accent-onaccent font-medium rounded-2xl rounded-tr-xs px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm text-sm sm:text-base leading-relaxed">
                            {m.image_base64 && (
                              <img
                                src={m.image_base64}
                                alt="User attachment"
                                className="w-full max-h-72 object-cover rounded-xl mb-2.5 border border-white/20 shadow-xs"
                              />
                            )}
                            <p className="whitespace-pre-line">{m.content}</p>
                          </div>

                          <span className="text-[11px] text-content-subtle px-1">{m.timestamp}</span>
                        </div>
                      )}

                      {/* Clickable Follow-up Suggestions (Patient's Voice) */}
                      {m.suggestions && m.suggestions.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-2 max-w-3xl">
                          {m.suggestions.map((s, sIdx) => {
                            let patientPrompt = s.trim();
                            patientPrompt = patientPrompt.replace(/^would you like (me to|to)\s+/i, '');
                            patientPrompt = patientPrompt.replace(/^do you want (me to|to)\s+/i, '');
                            patientPrompt = patientPrompt.replace(/^can i (help you|assist you with)\s+/i, '');
                            patientPrompt = patientPrompt.replace(/^how can i help you with\s+/i, '');
                            patientPrompt = patientPrompt.charAt(0).toUpperCase() + patientPrompt.slice(1);

                            return (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleSendMessage(patientPrompt)}
                                className="px-3.5 py-1.5 rounded-xl bg-surface-raised border border-line-strong text-content font-medium hover:border-accent hover:text-accent hover:shadow-xs transition-all text-xs text-left flex items-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <SparklesIcon size={12} className="text-accent shrink-0" />
                                <span>{patientPrompt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Always-accessible Quick Starters when few messages */}
                {messages.length <= 2 && !isLoading && (
                  <div className="pt-3 max-w-4xl mx-auto w-full space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-content-muted uppercase tracking-wider flex items-center gap-1.5">
                        <SparklesIcon size={13} className="text-accent" />
                        Suggested Clinical Inquiries
                      </span>
                      <span className="text-[11px] text-content-subtle hidden sm:inline">
                        Grounded in your medical cabinet & history
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {DEEP_CLINICAL_PROMPTS.map((sq, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(sq.prompt)}
                          className="p-3.5 rounded-2xl border border-line-strong bg-surface-raised hover:bg-surface-hover hover:border-accent/50 hover:shadow-card transition-all text-left flex items-start gap-3 shadow-2xs group cursor-pointer"
                        >
                          <span className="p-2.5 rounded-xl bg-accent/10 text-accent group-hover:bg-accent group-hover:text-accent-onaccent transition-all shrink-0 mt-0.5">
                            {sq.icon}
                          </span>
                          <div className="space-y-0.5">
                            <span className="font-bold text-xs sm:text-sm text-content block group-hover:text-accent transition-colors">
                              {sq.title}
                            </span>
                            <span className="text-xs text-content-muted line-clamp-2 leading-relaxed">
                              {sq.prompt}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Animated AI Thinking / Loading State */}
                {isLoading && (
                  <div className="flex flex-col items-start w-full max-w-4xl mx-auto space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 px-1">
                      <div className="w-7 h-7 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent shadow-2xs animate-pulse">
                        <SparklesIcon size={14} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-content">Medfolio AI</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-accent/10 text-accent font-bold text-[10px] uppercase tracking-wider">
                          Analyzing Records
                        </span>
                      </div>
                    </div>

                    <div className="bg-surface-raised border border-line-strong rounded-2xl rounded-tl-xs p-4 sm:p-5 shadow-card max-w-md w-full space-y-3">
                      <div className="flex items-center gap-2.5 text-xs text-content font-medium">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-accent animate-bounce" />
                          <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                          <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                        </div>
                        <span>Reviewing clinical records & guidelines...</span>
                      </div>
                      <div className="h-1.5 bg-surface-sunken rounded-full overflow-hidden w-full">
                        <div className="h-full bg-accent/50 rounded-full w-2/3 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Attached Photo Preview */}
            {attachedImage && (
              <div className="px-4 py-2 bg-accent/10 border-t border-line flex items-center justify-between text-xs text-content shrink-0 max-w-4xl mx-auto w-full">
                <span className="font-semibold truncate flex items-center gap-1.5">
                  <FolderIcon size={14} className="text-accent shrink-0" /> Photo attached for clinical review
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="text-risk-text font-bold hover:underline ml-2 shrink-0 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Ultra-Clean Modern Floating Composer Dock */}
            <div className="p-3 sm:p-4 bg-surface-raised/90 backdrop-blur-md border-t border-line shrink-0">
              <div className="max-w-4xl mx-auto space-y-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2 p-2 bg-surface-sunken border border-line-strong rounded-2xl focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all shadow-2xs"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImagePick}
                    aria-label="Attach prescription or lab slip"
                  />

                  {/* Photo Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach photo"
                    className="p-2.5 rounded-xl text-content-muted hover:text-accent hover:bg-surface-raised transition-colors shrink-0 cursor-pointer"
                    title="Attach photo of prescription or medicine strip"
                  >
                    <FolderIcon size={18} />
                  </button>

                  {/* Voice Mic Button */}
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}
                    className={`p-2.5 rounded-xl transition-all shrink-0 cursor-pointer ${
                      isRecording
                        ? 'bg-warn-bg text-warn-text animate-pulse shadow-xs'
                        : 'text-content-muted hover:text-accent hover:bg-surface-raised'
                    }`}
                    title={isRecording ? 'Listening... click to stop' : 'Dictate with voice'}
                  >
                    <MicrophoneIcon size={18} />
                  </button>

                  {/* Text Input */}
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      isRecording
                        ? 'Listening to your voice...'
                        : 'Ask about medications, dosage timing, lab tests, or attach photos...'
                    }
                    aria-label="Message the assistant"
                    className="flex-1 bg-transparent border-0 text-sm sm:text-base text-content placeholder:text-content-subtle focus:outline-none focus:ring-0 px-2 min-w-0"
                    disabled={isLoading}
                  />

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={(!input.trim() && !attachedImage) || isLoading}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                      input.trim() || attachedImage
                        ? 'bg-accent text-accent-onaccent shadow-xs hover:opacity-90 active:scale-95'
                        : 'bg-surface-raised border border-line text-content-subtle cursor-not-allowed opacity-50'
                    }`}
                    title="Send message"
                    aria-label="Send message"
                  >
                    <SendIcon size={16} />
                  </button>
                </form>

                <p className="text-center text-[11px] text-content-subtle flex items-center justify-center gap-1.5">
                  <ShieldIcon size={12} className="text-accent shrink-0" />
                  <span>Clinical AI assistant &bull; Grounded in your health records &bull; Always follow your doctor's instructions.</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Drug Interaction Radar */}
        {activeTab === 'radar' && (
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 max-w-4xl mx-auto w-full">
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
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 max-w-4xl mx-auto w-full">
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
          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 max-w-4xl mx-auto w-full">
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
          <div className="space-y-3.5 text-xs sm:text-sm text-content-muted leading-relaxed">
            <p>
              Medfolio's health assistant assists you in understanding prescriptions, organizing daily dose schedules, and reviewing lab results.
            </p>
            <div className="p-3.5 bg-surface-sunken border border-line rounded-xl space-y-1">
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

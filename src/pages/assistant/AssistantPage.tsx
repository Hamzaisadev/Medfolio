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
        <div className="shrink-0 h-12 px-3 sm:px-5 border-b border-line bg-surface-raised flex items-center justify-between gap-2 shadow-2xs z-10">
          {/* Left: Title & Record Badge */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-bold text-sm sm:text-base text-content">
              Health Assistant
            </span>
            <button
              type="button"
              onClick={() => setShowContextDrawer(!showContextDrawer)}
              className={`text-2xs font-semibold px-2 py-0.5 rounded-lg border flex items-center gap-1 transition-all ${
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
                  className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
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
              className="p-1.5 rounded-lg text-content-muted hover:text-content hover:bg-surface-hover transition-colors"
              title="Clinical safety & oversight"
            >
              <ShieldIcon size={15} />
            </button>
            <button
              type="button"
              onClick={handleClearChat}
              className="p-1.5 rounded-lg text-content-muted hover:text-risk-text hover:bg-risk-bg transition-colors"
              title="Clear conversation"
            >
              <TrashIcon size={15} />
            </button>
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
          <div className="flex-1 flex flex-col min-h-0">
            {/* Scrollable Messages Stream — Takes Majority of Screen */}
            <div ref={chatContainerRef} className="flex-1 p-3 sm:p-5 lg:p-6 overflow-y-auto space-y-4 text-sm sm:text-base">
              <div className="max-w-4xl mx-auto space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`p-4 sm:p-5 rounded-2xl leading-relaxed transition-all ${
                        m.role === 'user'
                          ? 'bg-accent text-content-onaccent rounded-br-xs font-medium max-w-[80%] text-sm sm:text-base shadow-sm'
                          : 'bg-surface-raised border border-line text-content rounded-bl-xs w-full shadow-card text-sm sm:text-base space-y-3'
                      }`}
                    >
                      {m.image_base64 && (
                        <img
                          src={m.image_base64}
                          alt="User attachment"
                          className="w-full max-h-72 object-cover rounded-xl mb-3 border border-line shadow-xs"
                        />
                      )}
                      <p className="whitespace-pre-line leading-relaxed">{m.content}</p>

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

                      {m.role === 'assistant' && m.id !== 'welcome' && (
                        <div className="pt-2 border-t border-line flex items-center justify-between text-2xs text-content-subtle">
                          <span>Grounded in patient health record</span>
                          <button
                            type="button"
                            onClick={() => handleToggleSpeak(m.id, m.content)}
                            className="text-accent hover:underline font-bold"
                          >
                            {speakingMsgId === m.id ? 'Stop audio' : 'Listen'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Clickable Follow-up Suggestions (Patient's Voice) */}
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 max-w-3xl">
                        {m.suggestions.map((s, sIdx) => {
                          // Normalize to patient's first-person phrasing
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
                              className="px-3 py-1.5 rounded-xl bg-surface-raised border border-line text-content font-medium hover:border-accent hover:text-accent transition-colors text-xs text-left flex items-center gap-1.5 shadow-2xs"
                            >
                              <SparklesIcon size={12} className="text-accent shrink-0" />
                              <span>{patientPrompt}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <span className="text-2xs text-content-subtle mt-1 px-2">{m.timestamp}</span>
                  </div>
                ))}

                {/* Show Quick Starters ONLY on empty / welcome state */}
                {messages.length <= 1 && (
                  <div className="pt-2">
                    <span className="text-xs font-bold text-content-muted block mb-2">
                      Suggested Clinical Inquiries
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {DEEP_CLINICAL_PROMPTS.map((sq, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(sq.prompt)}
                          className="p-3 rounded-xl border border-line bg-surface-raised hover:bg-surface-hover hover:border-accent/50 transition-all text-left flex items-center gap-2.5 shadow-2xs group"
                        >
                          <span className="p-2 rounded-lg bg-surface-sunken text-accent group-hover:bg-accent-subtle transition-colors shrink-0">
                            {sq.icon}
                          </span>
                          <div>
                            <span className="font-bold text-xs text-content block">
                              {sq.title}
                            </span>
                            <span className="text-2xs text-content-muted line-clamp-1">
                              {sq.prompt}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isLoading && (
                  <div className="flex items-center gap-2.5 p-3.5 bg-surface-raised border border-line rounded-2xl max-w-xs text-xs text-content-muted font-medium shadow-card">
                    <span>Analyzing clinical records</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
              </div>
            </div>

            {/* Attached Photo Preview */}
            {attachedImage && (
              <div className="px-4 py-2 bg-accent-subtle border-t border-line flex items-center justify-between text-xs text-content shrink-0 max-w-4xl mx-auto w-full">
                <span className="font-semibold truncate flex items-center gap-1.5">
                  <FolderIcon size={14} className="text-accent shrink-0" /> Photo attached for clinical review
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

            {/* Ultra-Clean Modern ChatGPT Input Dock */}
            <div className="p-3 sm:p-4 bg-surface-raised border-t border-line shrink-0">
              <div className="max-w-4xl mx-auto space-y-1.5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-1.5 p-1.5 bg-surface-sunken border border-line rounded-2xl focus-within:border-accent focus-within:ring-1 focus-within:ring-accent shadow-2xs"
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
                    className="p-2 rounded-xl text-content-muted hover:text-accent hover:bg-surface-raised transition-colors shrink-0"
                    title="Attach photo of prescription or medicine strip"
                  >
                    <FolderIcon size={18} />
                  </button>

                  {/* Voice Mic Button */}
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    aria-label={isRecording ? 'Stop voice input' : 'Start voice input'}
                    className={`p-2 rounded-xl transition-all shrink-0 ${
                      isRecording
                        ? 'bg-warn-bg text-warn-text animate-pulse'
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
                    placeholder={isRecording ? 'Listening...' : 'Ask about medications, dosage timing, lab tests, or attach photos...'}
                    aria-label="Message the assistant"
                    className="flex-1 bg-transparent border-0 text-sm text-content placeholder:text-content-subtle focus:outline-none focus:ring-0 px-2 min-w-0"
                    disabled={isLoading}
                  />

                  {/* Send Button */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={isLoading}
                    disabled={!input.trim() && !attachedImage}
                    className="h-9 px-4 rounded-xl font-bold shrink-0 text-xs shadow-xs"
                  >
                    Send
                  </Button>
                </form>

                <p className="text-center text-2xs text-content-subtle">
                  Clinical AI assistant &bull; Grounded in your health records &bull; Always follow your doctor's instructions.
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

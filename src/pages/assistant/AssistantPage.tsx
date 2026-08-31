import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  SearchIcon,
  MenuIcon,
} from '../../components/ui/icons';
import { medicinesRepo, visitsRepo, reportsRepo, profilesRepo, sideEffectsRepo, vitalsRepo, chatRepo } from '../../lib/db';
import type { ChatSession } from '../../lib/db/chat';
import { activeMedicines, type MedicineRecord } from '../../domain/activeMedicines';
import type { GlucoseReading, BloodPressureReading } from '../../domain/vitals';
import { todayInAppTz } from '../../lib/time';
import { DrugInteractionRadar } from '../../components/assistant/DrugInteractionRadar';
import { DoctorPrepBrief } from '../../components/assistant/DoctorPrepBrief';
import { BiomarkerTrajectory } from '../../components/assistant/BiomarkerTrajectory';
import { EditablePrescriptionWidget, type ExtractedMedItem } from '../../components/assistant/EditablePrescriptionWidget';
import { DailyScheduleClockWidget, type DailyScheduleSlot } from '../../components/assistant/DailyScheduleClockWidget';
import { PrescriptionDiffWidget, type PrescriptionDiffItem } from '../../components/assistant/PrescriptionDiffWidget';
import { ClinicalActionCards, type ClinicalActionCall } from '../../components/assistant/ClinicalActionCards';
import { ChatSidebar } from '../../components/assistant/ChatSidebar';
import { InChatSearchBar, renderHighlightedText } from '../../components/assistant/InChatSearchBar';
import { useAuth } from '../../lib/auth/AuthContext';
import { supabase } from '../../lib/supabase/client';
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
    prompt: 'Perform a comprehensive interaction and timing analysis on all my active medications.',
    icon: <MedicineIcon size={14} />,
  },
  {
    title: 'Review Glucose & Vitals',
    prompt: 'Analyze my recent blood glucose and blood pressure readings and evaluate how my metrics are trending.',
    icon: <BarChartIcon size={14} />,
  },
  {
    title: 'Analyze Lab Biomarkers',
    prompt: 'Correlate my recent lab report results with my prescribed medicines and flag any abnormal findings.',
    icon: <BarChartIcon size={14} />,
  },
  {
    title: 'Doctor Visit Prep Plan',
    prompt: 'Prepare a consultation summary with my recent vitals, medications, and questions for my next doctor checkup.',
    icon: <DoctorIcon size={14} />,
  },
];

function generateTitleFromPrompt(prompt: string): string {
  const cleaned = prompt.replace(/[^\w\s-]/g, '').trim();
  const words = cleaned.split(/\s+/).slice(0, 6).join(' ');
  if (!words) return 'Health Consultation';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const getOldChatStorageKey = (profileId: string) => `medfolio_assistant_messages_v3_${profileId || 'default'}`;

export function AssistantPage() {
  const { user, profile: authProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'radar' | 'doctor-prep' | 'biomarkers'>('chat');
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [matchedMessageMap, setMatchedMessageMap] = useState<Record<string, string[]>>({});

  const [showInChatSearch, setShowInChatSearch] = useState(false);
  const [inChatQuery, setInChatQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(1);

  const effectiveUserId = user?.id || authProfile?.user_id || '';
  const effectiveProfileId = authProfile?.id || effectiveUserId || 'default';

  const [messages, setMessages] = useState<Message[]>([]);
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
  const [glucoseLogs, setGlucoseLogs] = useState<GlucoseReading[]>([]);
  const [bpLogs, setBpLogs] = useState<BloodPressureReading[]>([]);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<unknown>(null);
  const today = todayInAppTz();

  const loadData = useCallback(async () => {
    if (!effectiveUserId) return;
    try {
      const [p, mList, vList, rList, sList, gList, bpList] = await Promise.all([
        profilesRepo.getDefaultProfile(effectiveUserId),
        medicinesRepo.listMedicines(effectiveProfileId),
        visitsRepo.listVisits(effectiveProfileId),
        reportsRepo.listReports(effectiveProfileId),
        sideEffectsRepo.listSideEffects(effectiveProfileId),
        vitalsRepo.listGlucoseReadings(effectiveProfileId),
        vitalsRepo.listBloodPressureReadings(effectiveProfileId),
      ]);
      setProfile(p);
      setMedicines(mList);
      setVisits(vList);
      setReports(rList);
      setSideEffects(sList);
      setGlucoseLogs(gList);
      setBpLogs(bpList);

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

  const loadSessions = useCallback(async () => {
    if (!effectiveProfileId || !effectiveUserId) return;
    try {
      const dbSessions = await chatRepo.listSessions(effectiveProfileId);

      if (dbSessions.length > 0 && dbSessions[0]) {
        setSessions(dbSessions);
        if (!activeSessionId || !dbSessions.some((s) => s.id === activeSessionId)) {
          setActiveSessionId(dbSessions[0].id);
        }
      } else {
        let initialMessages: Message[] = [];
        try {
          const oldSaved = localStorage.getItem(getOldChatStorageKey(effectiveProfileId));
          if (oldSaved) {
            const parsed = JSON.parse(oldSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              initialMessages = parsed;
            }
          }
        } catch {
          // ignore
        }

        const firstPrompt = initialMessages.find((m) => m.role === 'user')?.content;
        const initialTitle = firstPrompt ? generateTitleFromPrompt(firstPrompt) : 'New Conversation';

        const newSession = await chatRepo.createSession({
          user_id: effectiveUserId,
          profile_id: effectiveProfileId,
          title: initialTitle,
        });

        if (initialMessages.length > 0) {
          await Promise.all(
            initialMessages.map((m) =>
              chatRepo.createMessage({
                id: m.id.startsWith('welcome') || m.id.startsWith('user-') || m.id.startsWith('bot-') ? undefined : m.id,
                session_id: newSession.id,
                user_id: effectiveUserId,
                profile_id: effectiveProfileId,
                role: m.role,
                content: m.content,
                metadata: {
                  medicines: m.medicines || [],
                  dailySchedule: m.dailySchedule || [],
                  diffAnalysis: m.diffAnalysis || [],
                  actionCall: m.actionCall,
                  safetyAlerts: m.safetyAlerts || [],
                  suggestions: m.suggestions || [],
                  citations: m.citations || [],
                  sentinelAlerts: m.sentinelAlerts || [],
                  biomarkerTrajectories: m.biomarkerTrajectories || [],
                } as unknown as Tables<'chat_messages'>['metadata'],
              })
            )
          );
          localStorage.removeItem(getOldChatStorageKey(effectiveProfileId));
        } else {
          await chatRepo.createMessage({
            session_id: newSession.id,
            user_id: effectiveUserId,
            profile_id: effectiveProfileId,
            role: 'assistant',
            content: 'Welcome to Shifa — your Clinical Health Co-Pilot. I am grounded directly in your active prescriptions, glucose & vitals logs, and lab results. Ask health questions, check drug interactions, or upload prescription slips.',
          });
        }

        setSessions([newSession]);
        setActiveSessionId(newSession.id);
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  }, [effectiveProfileId, effectiveUserId, activeSessionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadActiveMessages = useCallback(async () => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    try {
      const dbMsgs = await chatRepo.listMessages(activeSessionId);
      if (dbMsgs.length > 0) {
        const mapped: Message[] = dbMsgs.map((m) => {
          const meta = (m.metadata as Record<string, unknown>) || {};
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            image_base64: m.image_url || null,
            image_mime: null,
            medicines: (meta.medicines as ExtractedMedItem[]) || undefined,
            dailySchedule: (meta.dailySchedule as DailyScheduleSlot[]) || undefined,
            diffAnalysis: (meta.diffAnalysis as PrescriptionDiffItem[]) || undefined,
            actionCall: (meta.actionCall as ClinicalActionCall) || undefined,
            safetyAlerts: (meta.safetyAlerts as string[]) || undefined,
            suggestions: (meta.suggestions as string[]) || undefined,
            citations: (meta.citations as Array<{ source: string; type: string; detail: string }>) || undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sentinelAlerts: (meta.sentinelAlerts as any) || undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            biomarkerTrajectories: (meta.biomarkerTrajectories as any) || undefined,
          };
        });
        setMessages(mapped);
      } else {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: 'How can I assist you with your medications, lab results, or vitals today?',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err) {
      console.error('Failed to load messages for active session:', err);
    }
  }, [activeSessionId]);

  useEffect(() => {
    loadActiveMessages();
  }, [loadActiveMessages]);

  useEffect(() => {
    if (!effectiveProfileId) return;
    const handler = setTimeout(async () => {
      if (!sidebarSearchQuery.trim()) {
        const all = await chatRepo.listSessions(effectiveProfileId);
        setSessions(all);
        setMatchedMessageMap({});
        return;
      }
      const searchRes = await chatRepo.searchChatHistory(effectiveProfileId, sidebarSearchQuery);
      setSessions(searchRes.sessions);
      setMatchedMessageMap(searchRes.matchedMessageMap);
    }, 200);

    return () => clearTimeout(handler);
  }, [sidebarSearchQuery, effectiveProfileId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && activeTab === 'chat') {
        e.preventDefault();
        setShowInChatSearch(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const matchedMessageIndices = useMemo(() => {
    if (!inChatQuery.trim()) return [];
    const q = inChatQuery.toLowerCase();
    return messages
      .map((m, idx) => (m.content.toLowerCase().includes(q) ? idx : -1))
      .filter((idx) => idx !== -1);
  }, [messages, inChatQuery]);

  const matchCount = matchedMessageIndices.length;

  const scrollToMatch = useCallback(
    (matchIdx: number) => {
      if (matchIdx < 0 || matchIdx >= matchedMessageIndices.length) return;
      const targetMsgIndex = matchedMessageIndices[matchIdx];
      if (targetMsgIndex !== undefined) {
        const targetMsg = messages[targetMsgIndex];
        if (targetMsg) {
          const el = document.getElementById(`msg-bubble-${targetMsg.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    },
    [matchedMessageIndices, messages]
  );

  const handleNextMatch = () => {
    if (matchCount === 0) return;
    const next = currentMatchIndex >= matchCount ? 1 : currentMatchIndex + 1;
    setCurrentMatchIndex(next);
    scrollToMatch(next - 1);
  };

  const handlePrevMatch = () => {
    if (matchCount === 0) return;
    const prev = currentMatchIndex <= 1 ? matchCount : currentMatchIndex - 1;
    setCurrentMatchIndex(prev);
    scrollToMatch(prev - 1);
  };

  const handleNewChat = async () => {
    if (!effectiveUserId || !effectiveProfileId) return;
    try {
      const newSession = await chatRepo.createSession({
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        title: 'New Conversation',
      });
      await chatRepo.createMessage({
        session_id: newSession.id,
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        role: 'assistant',
        content: 'Welcome to Shifa — your Clinical Health Co-Pilot. I am grounded directly in your active prescriptions, glucose & vitals logs, and lab results. Ask health questions, check drug interactions, or upload prescription slips.',
      });
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setActiveTab('chat');
    } catch (err) {
      console.error('Failed to create new chat session:', err);
    }
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      await chatRepo.updateSession(sessionId, { title: newTitle });
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s)));
    } catch (err) {
      console.error('Failed to rename chat session:', err);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await chatRepo.deleteSession(sessionId);
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        if (remaining.length > 0 && remaining[0]) {
          setActiveSessionId(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
      setToastMessage('Conversation deleted.');
    } catch (err) {
      console.error('Failed to delete chat session:', err);
    }
  };

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
    } catch {
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

  const handleClearChat = async () => {
    if (!activeSessionId || !effectiveUserId || !effectiveProfileId) return;
    try {
      await chatRepo.deleteSession(activeSessionId);
      const remaining = sessions.filter((s) => s.id !== activeSessionId);
      setSessions(remaining);
      handleNewChat();
      setToastMessage('Conversation cleared.');
    } catch (err) {
      console.error('Failed to clear conversation:', err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if ((!text && !attachedImage) || isLoading) return;

    setActiveTab('chat');

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const newSession = await chatRepo.createSession({
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        title: generateTitleFromPrompt(text || 'Prescription Review'),
      });
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      currentSessionId = newSession.id;
    } else {
      // Auto-name if currently default title
      const curr = sessions.find((s) => s.id === currentSessionId);
      if (curr && (curr.title === 'New Conversation' || curr.title === 'New Consultation')) {
        const newTitle = generateTitleFromPrompt(text || 'Prescription Review');
        chatRepo.updateSession(currentSessionId, { title: newTitle });
        setSessions((prev) => prev.map((s) => (s.id === currentSessionId ? { ...s, title: newTitle } : s)));
      }
    }

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text || 'Please review this attached prescription and extract the medications.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      image_base64: attachedImage?.base64,
      image_mime: attachedImage?.mime,
    };

    const botMsgId = `bot-${Date.now()}`;
    const initialBotMsg: Message = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, initialBotMsg]);
    setInput('');
    const currentImg = attachedImage;
    setAttachedImage(null);
    setIsLoading(true);

    // Persist user message to Supabase
    chatRepo.createMessage({
      session_id: currentSessionId,
      user_id: effectiveUserId,
      profile_id: effectiveProfileId,
      role: 'user',
      content: userMsg.content,
      image_url: userMsg.image_base64 || null,
    }).catch((err) => console.warn('Failed to persist user message:', err));

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
        glucoseLogs: glucoseLogs.map((g) => ({
          measured_at: g.measured_at,
          value_mg_dl: g.value_mg_dl,
          type: g.type,
          notes: g.notes || null,
        })),
        bloodPressureLogs: bpLogs.map((b) => ({
          measured_at: b.measured_at,
          systolic: b.systolic,
          diastolic: b.diastolic,
          pulse_bpm: b.pulse_bpm ?? null,
          arm: b.arm ?? null,
          posture: b.posture ?? null,
          notes: b.notes || null,
        })),
        sideEffectsHistory: sideEffects.map((s) => ({
          medicine_name: s.medicine_name,
          note: s.note,
          severity: s.severity,
          occurred_at: s.occurred_at,
        })),
      };

      // Retrieve verified Supabase session token for authenticated AI endpoint
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const validHistory = messages
        .filter((m) => Boolean(m.content && m.content.trim().length > 0 && !m.content.startsWith('Sorry, I encountered an issue')))
        .map((m) => ({
          role: m.role,
          content: m.content,
          image_base64: m.image_base64,
          image_mime: m.image_mime,
        }));

      const response = await fetch('/api/chat-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          stream: true,
          messages: [
            ...validHistory,
            {
              role: userMsg.role,
              content: userMsg.content,
              image_base64: userMsg.image_base64,
              image_mime: userMsg.image_mime,
            },
          ],
          patientContext,
        }),
      });


      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Error from assistant (Status ${response.status})`);
      }

      let accumulatedSummary = '';
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let streamDone = false;
        let lineBuffer = '';

        while (!streamDone) {
          const { value, done } = await reader.read();
          streamDone = done;

          if (value) {
            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const dataStr = trimmed.replace(/^data:\s*/, '');
              if (dataStr === '[DONE]') break;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.type === 'token' && typeof parsed.content === 'string') {
                  accumulatedSummary += parsed.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMsgId
                        ? { ...msg, content: accumulatedSummary }
                        : msg
                    )
                  );
                } else if (parsed.type === 'complete' && parsed.data) {
                  const data = parsed.data;
                  const finalContent = data.summary || accumulatedSummary || 'Analysis complete.';
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === botMsgId
                        ? {
                            ...msg,
                            content: finalContent,
                            medicines: data.medicines || [],
                            dailySchedule: data.dailySchedule || [],
                            diffAnalysis: data.diffAnalysis || [],
                            actionCall: data.actionCall,
                            safetyAlerts: data.safetyAlerts || [],
                            suggestions: data.suggestions || [],
                            citations: data.citations || [],
                            sentinelAlerts: data.sentinelAlerts || [],
                            biomarkerTrajectories: data.biomarkerTrajectories || [],
                          }
                        : msg
                    )
                  );

                  // Persist completed bot message to Supabase
                  chatRepo.createMessage({
                    session_id: currentSessionId,
                    user_id: effectiveUserId,
                    profile_id: effectiveProfileId,
                    role: 'assistant',
                    content: finalContent,
                    metadata: {
                      medicines: data.medicines || [],
                      dailySchedule: data.dailySchedule || [],
                      diffAnalysis: data.diffAnalysis || [],
                      actionCall: data.actionCall || null,
                      safetyAlerts: data.safetyAlerts || [],
                      suggestions: data.suggestions || [],
                      citations: data.citations || [],
                      sentinelAlerts: data.sentinelAlerts || [],
                      biomarkerTrajectories: data.biomarkerTrajectories || [],
                    },
                  }).catch((err) => console.warn('Failed to persist bot message:', err));
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error || 'Assistant streaming issue');
                }
              } catch {
                // Ignore transient incomplete SSE line parse errors
              }
            }
          }
        }
      } else {
        // Fallback for environments where body stream is unavailable
        const textRes = await response.text();
        const data = JSON.parse(textRes);
        const finalContent = data.summary || 'Analysis complete.';
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === botMsgId
              ? {
                  ...msg,
                  content: finalContent,
                  medicines: data.medicines || [],
                  dailySchedule: data.dailySchedule || [],
                  diffAnalysis: data.diffAnalysis || [],
                  actionCall: data.actionCall,
                  safetyAlerts: data.safetyAlerts || [],
                  suggestions: data.suggestions || [],
                  citations: data.citations || [],
                  sentinelAlerts: data.sentinelAlerts || [],
                  biomarkerTrajectories: data.biomarkerTrajectories || [],
                }
              : msg
          )
        );

        chatRepo.createMessage({
          session_id: currentSessionId,
          user_id: effectiveUserId,
          profile_id: effectiveProfileId,
          role: 'assistant',
          content: finalContent,
          metadata: {
            medicines: data.medicines || [],
            dailySchedule: data.dailySchedule || [],
            diffAnalysis: data.diffAnalysis || [],
            actionCall: data.actionCall || null,
            safetyAlerts: data.safetyAlerts || [],
            suggestions: data.suggestions || [],
            citations: data.citations || [],
            sentinelAlerts: data.sentinelAlerts || [],
            biomarkerTrajectories: data.biomarkerTrajectories || [],
          },
        }).catch((err) => console.warn('Failed to persist bot message:', err));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error communicating with assistant';
      const errorContent = `Sorry, I encountered an issue: ${msg}. Please try again.`;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                content: errorContent,
              }
            : m
        )
      );

      chatRepo.createMessage({
        session_id: currentSessionId,
        user_id: effectiveUserId,
        profile_id: effectiveProfileId,
        role: 'assistant',
        content: errorContent,
      }).catch((e) => console.warn('Failed to persist error message:', e));
    } finally {
      setIsLoading(false);
      if (fileInputRef.current && currentImg) {
        fileInputRef.current.value = '';
      }
    }
  };

  const activeSessionTitle = sessions.find((s) => s.id === activeSessionId)?.title || 'Shifa Consultation';

  return (
    <AppShell fullWidth noPadding fixedViewport>
      <div className="flex-1 flex h-full min-h-0 w-full bg-surface-sunken overflow-hidden">
        {/* Chat Sessions History Sidebar */}
        <ChatSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => setActiveSessionId(id)}
          onNewChat={handleNewChat}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
          searchQuery={sidebarSearchQuery}
          onSearchChange={setSidebarSearchQuery}
          matchedMessageMap={matchedMessageMap}
        />

        {/* Main Conversation & Analysis Area */}
        <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 bg-surface-sunken relative">
          {/* Streamlined Single-Line Header Bar */}
          <div className="shrink-0 border-b border-line bg-surface-raised shadow-2xs z-10 px-3 sm:px-6">
            <div className="max-w-5xl mx-auto h-13 sm:h-14 flex items-center justify-between gap-2">
              {/* Left: Sidebar Toggle, Title & Record Badge */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={`p-2 rounded-xl text-content-muted hover:text-content hover:bg-surface-hover transition-colors cursor-pointer shrink-0 ${
                    isSidebarOpen ? 'bg-surface-sunken text-accent' : ''
                  }`}
                  title={isSidebarOpen ? 'Collapse chat history' : 'Open chat history'}
                >
                  <MenuIcon size={16} />
                </button>

                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-sm sm:text-base text-content truncate">
                    {activeSessionTitle}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowContextDrawer(!showContextDrawer)}
                    className={`text-2xs font-semibold px-2 py-0.5 rounded-lg border hidden sm:flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      showContextDrawer
                        ? 'bg-accent text-content-onaccent border-accent shadow-xs'
                        : 'bg-surface-sunken text-content-muted border-line hover:border-line-strong hover:text-content'
                    }`}
                    title="Click to view active health context"
                  >
                    <FolderIcon size={12} />
                    <span>{activeMedsList.length} Meds</span>
                  </button>
                </div>
              </div>

              {/* Center: Sleek Segmented Mode Tabs */}
              <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-xl border border-line shrink-0">
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
                      className={`px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? 'bg-surface-raised text-accent shadow-xs border border-line'
                          : 'text-content-muted hover:text-content'
                      }`}
                    >
                      {tab.icon}
                      <span className="hidden md:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right: Actions (Find in Chat, Safety, Clear) */}
              <div className="flex items-center gap-1 shrink-0">
                {activeTab === 'chat' && (
                  <button
                    type="button"
                    onClick={() => setShowInChatSearch(!showInChatSearch)}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      showInChatSearch
                        ? 'bg-accent/10 text-accent font-bold'
                        : 'text-content-muted hover:text-content hover:bg-surface-hover'
                    }`}
                    title="Find in conversation (Ctrl+F)"
                  >
                    <SearchIcon size={16} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSafetyModal(true)}
                  className="p-2 rounded-lg text-content-muted hover:text-content hover:bg-surface-hover transition-colors cursor-pointer"
                  title="Clinical safety & oversight"
                >
                  <ShieldIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="p-2 rounded-lg text-content-muted hover:text-risk-text hover:bg-risk-bg transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  <TrashIcon size={16} />
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

          {/* In-Chat Search Bar */}
          <InChatSearchBar
            isOpen={showInChatSearch && activeTab === 'chat'}
            onClose={() => {
              setShowInChatSearch(false);
              setInChatQuery('');
            }}
            query={inChatQuery}
            onQueryChange={(q) => {
              setInChatQuery(q);
              setCurrentMatchIndex(1);
            }}
            matchCount={matchCount}
            currentMatchIndex={currentMatchIndex}
            onNextMatch={handleNextMatch}
            onPrevMatch={handlePrevMatch}
          />

          {/* Collapsible Record Grounding Context Drawer */}
          {showContextDrawer && (
            <div className="shrink-0 p-4 sm:p-5 bg-surface-raised border-b border-line shadow-card animate-in fade-in slide-in-from-top-2 duration-150 px-4 sm:px-6">
              <div className="max-w-5xl mx-auto space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-content">Patient Record Grounding (RAG Active)</span>
                  <button
                    type="button"
                    onClick={() => setShowContextDrawer(false)}
                    className="text-content-muted hover:text-content p-1 rounded-md cursor-pointer"
                  >
                    <XIcon size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
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
                      Vitals & Glucose Logs
                    </span>
                    {glucoseLogs.length > 0 && glucoseLogs[0] ? (
                      <p className="text-content font-bold text-2xs">
                        Latest Glucose: {glucoseLogs[0].value_mg_dl} mg/dL ({glucoseLogs[0].type})
                      </p>
                    ) : (
                      <p className="text-content-subtle italic text-2xs">No glucose logs recorded.</p>
                    )}
                    {bpLogs.length > 0 && bpLogs[0] && (
                      <p className="text-content-muted text-2xs mt-0.5 font-medium">
                        Latest BP: {bpLogs[0].systolic}/{bpLogs[0].diastolic} mmHg
                      </p>
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
                        id={`msg-bubble-${m.id}`}
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
                                  <span className="font-bold text-xs sm:text-sm text-content">Shifa</span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-accent/10 text-accent font-bold text-[10px] uppercase tracking-wider">
                                    {!m.content && isLoading ? 'Analyzing Records...' : 'Clinical Copilot'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 text-content-subtle">
                                {m.content && (
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
                                )}
                                {m.id !== 'welcome' && m.content && (
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
                              {m.content ? (
                                <p className="whitespace-pre-line leading-relaxed text-content">
                                  {renderHighlightedText(m.content, inChatQuery)}
                                </p>
                              ) : (
                                <div className="flex items-center gap-2.5 py-1.5 text-content-muted text-xs font-medium">
                                  <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-accent animate-bounce" />
                                    <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                                    <div className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                                  </div>
                                  <span>Consulting clinical records & pharmacological guidelines...</span>
                                </div>
                              )}

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
                            </div>


                            <span className="text-[11px] text-content-subtle px-1">{m.timestamp}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end space-y-1.5 max-w-[85%] sm:max-w-[75%] pr-1">
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
                              <p className="whitespace-pre-line">
                                {renderHighlightedText(m.content, inChatQuery)}
                              </p>
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
                    <span>Clinical health co-pilot &bull; Grounded in your health records &bull; Always follow your doctor's instructions.</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Drug Interaction Radar */}
          {activeTab === 'radar' && (
            <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 max-w-5xl mx-auto w-full">
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
            <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 max-w-5xl mx-auto w-full">
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
            <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 max-w-5xl mx-auto w-full">
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
      </div>
    </AppShell>
  );
}


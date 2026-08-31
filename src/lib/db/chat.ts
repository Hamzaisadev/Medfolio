import { supabase } from '../supabase/client';
import type { Tables, InsertTables, UpdateTables } from '../supabase/types';
import { getLocalItems, setLocalItems, deleteLocalItem, newId } from './localStore';
import { listWithFallback, insertWithFallback } from './offlineFallback';

export type ChatSession = Tables<'chat_sessions'>;
export type ChatSessionInsert = InsertTables<'chat_sessions'>;
export type ChatSessionUpdate = UpdateTables<'chat_sessions'>;

export type ChatMessage = Tables<'chat_messages'>;
export type ChatMessageInsert = InsertTables<'chat_messages'>;
export type ChatMessageUpdate = UpdateTables<'chat_messages'>;

export async function listSessions(profileId: string): Promise<ChatSession[]> {
  return listWithFallback<ChatSession>(
    'listSessions',
    'chat_sessions',
    () =>
      supabase
        .from('chat_sessions')
        .select('*')
        .eq('profile_id', profileId)
        .order('updated_at', { ascending: false }),
    (items) =>
      items
        .filter((s) => s.profile_id === profileId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  );
}

export async function createSession(session: ChatSessionInsert): Promise<ChatSession> {
  const payload: ChatSessionInsert = {
    ...session,
    id: session.id || newId(),
    title: session.title || 'New Conversation',
    is_pinned: session.is_pinned ?? false,
    created_at: session.created_at || new Date().toISOString(),
    updated_at: session.updated_at || new Date().toISOString(),
  };

  return insertWithFallback<ChatSession>(
    'createSession',
    'chat_sessions',
    () => supabase.from('chat_sessions').insert(payload).select().single(),
    () => payload as ChatSession
  );
}

export async function updateSession(id: string, updates: ChatSessionUpdate): Promise<void> {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from('chat_sessions')
      .update(payload)
      .eq('id', id);

    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn('updateSession remote failed, updating local fallback:', err);
  }

  // Update local fallback
  const local = getLocalItems<ChatSession>('chat_sessions');
  const index = local.findIndex((s) => s.id === id);
  if (index >= 0) {
    local[index] = { ...local[index], ...payload } as ChatSession;
    setLocalItems('chat_sessions', local);
  }
}

export async function deleteSession(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('chat_sessions').delete().eq('id', id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn('deleteSession remote failed, deleting local fallback:', err);
  }

  deleteLocalItem('chat_sessions', id);

  // Also clean up local messages for this session
  const localMsgs = getLocalItems<ChatMessage>('chat_messages').filter((m) => m.session_id !== id);
  setLocalItems('chat_messages', localMsgs);
}

export async function listMessages(sessionId: string): Promise<ChatMessage[]> {
  return listWithFallback<ChatMessage>(
    'listMessages',
    'chat_messages',
    () =>
      supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
    (items) =>
      items
        .filter((m) => m.session_id === sessionId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  );
}

export async function createMessage(message: ChatMessageInsert): Promise<ChatMessage> {
  const payload: ChatMessageInsert = {
    ...message,
    id: message.id || newId(),
    created_at: message.created_at || new Date().toISOString(),
    metadata: message.metadata ?? {},
  };

  return insertWithFallback<ChatMessage>(
    'createMessage',
    'chat_messages',
    () => supabase.from('chat_messages').insert(payload).select().single(),
    () => payload as ChatMessage
  );
}

export async function updateMessage(id: string, updates: ChatMessageUpdate): Promise<void> {
  try {
    const { error } = await supabase
      .from('chat_messages')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn('updateMessage remote failed, updating local fallback:', err);
  }

  const local = getLocalItems<ChatMessage>('chat_messages');
  const index = local.findIndex((m) => m.id === id);
  if (index >= 0) {
    local[index] = { ...local[index], ...updates } as ChatMessage;
    setLocalItems('chat_messages', local);
  }
}

/**
 * Search sessions by title OR message content.
 */
export async function searchChatHistory(
  profileId: string,
  query: string
): Promise<{ sessions: ChatSession[]; matchedMessageMap: Record<string, string[]> }> {
  const cleanQ = query.trim().toLowerCase();
  if (!cleanQ) {
    const allSessions = await listSessions(profileId);
    return { sessions: allSessions, matchedMessageMap: {} };
  }

  try {
    // 1. Fetch matching messages
    const { data: matchedMsgs } = await supabase
      .from('chat_messages')
      .select('session_id, content')
      .eq('profile_id', profileId)
      .ilike('content', `%${cleanQ}%`);

    // 2. Fetch matching sessions by title
    const { data: titleMatchedSessions } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('profile_id', profileId)
      .ilike('title', `%${cleanQ}%`);

    const matchedSessionIds = new Set<string>();
    const matchedMessageMap: Record<string, string[]> = {};

    (matchedMsgs || []).forEach((m) => {
      matchedSessionIds.add(m.session_id);
      if (!matchedMessageMap[m.session_id]) {
        matchedMessageMap[m.session_id] = [];
      }
      matchedMessageMap[m.session_id]?.push(m.content);
    });

    (titleMatchedSessions || []).forEach((s) => {
      matchedSessionIds.add(s.id);
    });

    if (matchedSessionIds.size === 0) {
      return { sessions: [], matchedMessageMap: {} };
    }

    const { data: finalSessions } = await supabase
      .from('chat_sessions')
      .select('*')
      .in('id', Array.from(matchedSessionIds))
      .order('updated_at', { ascending: false });

    return {
      sessions: finalSessions || [],
      matchedMessageMap,
    };
  } catch (err) {
    console.warn('Backend searchChatHistory failed, using client-side fallback:', err);
    const allSessions = await listSessions(profileId);
    const allMsgs = getLocalItems<ChatMessage>('chat_messages');

    const matchedMessageMap: Record<string, string[]> = {};
    const filtered = allSessions.filter((s) => {
      const titleMatch = s.title.toLowerCase().includes(cleanQ);
      const sessionMsgs = allMsgs.filter(
        (m) => m.session_id === s.id && m.content.toLowerCase().includes(cleanQ)
      );
      if (sessionMsgs.length > 0) {
        matchedMessageMap[s.id] = sessionMsgs.map((m) => m.content);
      }
      return titleMatch || sessionMsgs.length > 0;
    });

    return { sessions: filtered, matchedMessageMap };
  }
}

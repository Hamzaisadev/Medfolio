import React, { useState, useMemo } from 'react';
import type { ChatSession } from '../../lib/db/chat';
import {
  PlusIcon,
  SearchIcon,
  XIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  MessageSquareIcon,
  SparklesIcon,
} from '../ui/icons';

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onDeleteSession: (sessionId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  matchedMessageMap?: Record<string, string[]>;
}

export function ChatSidebar({
  isOpen,
  onToggle,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
  searchQuery,
  onSearchChange,
  matchedMessageMap = {},
}: ChatSidebarProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (sessionId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  const handleCancelRename = () => {
    setEditingSessionId(null);
    setEditTitle('');
  };

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteSession(sessionId);
    setSessionToDelete(null);
  };

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const sevenDaysAgo = today - 7 * 86400000;

    const groups: {
      pinned: ChatSession[];
      today: ChatSession[];
      yesterday: ChatSession[];
      last7Days: ChatSession[];
      older: ChatSession[];
    } = {
      pinned: [],
      today: [],
      yesterday: [],
      last7Days: [],
      older: [],
    };

    sessions.forEach((s) => {
      if (s.is_pinned) {
        groups.pinned.push(s);
        return;
      }
      const time = new Date(s.updated_at || s.created_at).getTime();
      if (time >= today) {
        groups.today.push(s);
      } else if (time >= yesterday) {
        groups.yesterday.push(s);
      } else if (time >= sevenDaysAgo) {
        groups.last7Days.push(s);
      } else {
        groups.older.push(s);
      }
    });

    return groups;
  }, [sessions]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-xs transition-opacity"
        onClick={onToggle}
        aria-hidden="true"
      />

      {/* Sidebar Container */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 sm:w-80 bg-surface-raised border-r border-line flex flex-col h-full shrink-0 shadow-lg md:shadow-none transition-transform duration-200 ease-in-out`}
      >
        {/* Top Header: New Chat & Close */}
        <div className="p-3.5 border-b border-line space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) onToggle();
              }}
              className="flex-1 bg-accent text-accent-onaccent font-bold py-2.5 px-3.5 rounded-xl hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer text-xs sm:text-sm"
            >
              <PlusIcon size={16} />
              <span>New Consultation</span>
            </button>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={onToggle}
              className="p-2 rounded-xl text-content-muted hover:text-content hover:bg-surface-hover md:hidden cursor-pointer"
              title="Close sidebar"
            >
              <XIcon size={18} />
            </button>
          </div>

          {/* Global Search Input */}
          <div className="relative flex items-center">
            <SearchIcon size={14} className="absolute left-3 text-content-subtle pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search past conversations..."
              className="w-full pl-8.5 pr-8 py-1.5 bg-surface-sunken border border-line rounded-lg text-xs text-content placeholder:text-content-subtle focus:outline-none focus:border-accent transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 text-content-subtle hover:text-content p-0.5"
              >
                <XIcon size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
          {sessions.length === 0 ? (
            <div className="text-center py-8 px-4 space-y-2">
              <MessageSquareIcon size={24} className="mx-auto text-content-subtle opacity-50" />
              <p className="text-xs text-content-muted font-medium">
                {searchQuery ? `No chats matching "${searchQuery}"` : 'No conversation history yet.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="text-2xs text-accent font-bold hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Group: Pinned */}
              {groupedSessions.pinned.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-content-subtle">
                    Pinned
                  </div>
                  {groupedSessions.pinned.map(renderSessionItem)}
                </div>
              )}

              {/* Group: Today */}
              {groupedSessions.today.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-content-subtle">
                    Today
                  </div>
                  {groupedSessions.today.map(renderSessionItem)}
                </div>
              )}

              {/* Group: Yesterday */}
              {groupedSessions.yesterday.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-content-subtle">
                    Yesterday
                  </div>
                  {groupedSessions.yesterday.map(renderSessionItem)}
                </div>
              )}

              {/* Group: Previous 7 Days */}
              {groupedSessions.last7Days.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-content-subtle">
                    Previous 7 Days
                  </div>
                  {groupedSessions.last7Days.map(renderSessionItem)}
                </div>
              )}

              {/* Group: Older */}
              {groupedSessions.older.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-content-subtle">
                    Older
                  </div>
                  {groupedSessions.older.map(renderSessionItem)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-line text-center">
          <span className="text-[11px] text-content-subtle font-medium flex items-center justify-center gap-1">
            <SparklesIcon size={12} className="text-accent" />
            <span>Secure Cloud Sync Active</span>
          </span>
        </div>
      </aside>
    </>
  );

  function renderSessionItem(session: ChatSession) {
    const isActive = session.id === activeSessionId;
    const isEditing = session.id === editingSessionId;
    const isDeleting = session.id === sessionToDelete;
    const matchedSnippets = matchedMessageMap[session.id] || [];

    if (isEditing) {
      return (
        <form
          key={session.id}
          onSubmit={(e) => handleSaveRename(session.id, e)}
          className="flex items-center gap-1 p-1 bg-surface-sunken border border-accent rounded-xl"
        >
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 bg-transparent px-2 py-1 text-xs text-content focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleCancelRename();
            }}
          />
          <button
            type="submit"
            className="p-1 rounded text-ok-text hover:bg-ok-bg cursor-pointer"
            title="Save title"
          >
            <CheckIcon size={13} />
          </button>
          <button
            type="button"
            onClick={handleCancelRename}
            className="p-1 rounded text-content-muted hover:bg-surface-hover cursor-pointer"
            title="Cancel"
          >
            <XIcon size={13} />
          </button>
        </form>
      );
    }

    if (isDeleting) {
      return (
        <div
          key={session.id}
          className="flex items-center justify-between p-2 rounded-xl bg-risk-bg border border-risk-border text-xs text-risk-text animate-in fade-in"
        >
          <span className="font-semibold truncate">Delete this chat?</span>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <button
              type="button"
              onClick={(e) => handleDelete(session.id, e)}
              className="px-2 py-1 rounded bg-risk-fill text-content-onaccent font-bold text-2xs cursor-pointer hover:opacity-90"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSessionToDelete(null);
              }}
              className="px-1.5 py-1 rounded text-content-muted hover:text-content text-2xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        key={session.id}
        className={`group relative flex flex-col gap-1 p-2.5 rounded-xl text-xs transition-all ${
          isActive
            ? 'bg-accent/10 border border-accent/30 text-accent font-semibold shadow-2xs'
            : 'text-content hover:bg-surface-hover border border-transparent'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5 w-full">
          <button
            type="button"
            onClick={() => {
              onSelectSession(session.id);
              if (window.innerWidth < 768) onToggle();
            }}
            className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer bg-transparent border-0 p-0 focus:outline-none"
          >
            <MessageSquareIcon
              size={14}
              className={`shrink-0 ${isActive ? 'text-accent' : 'text-content-subtle group-hover:text-content'}`}
            />
            <span className="truncate text-xs">{session.title}</span>
          </button>

          {/* Action buttons (Rename / Delete) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={(e) => handleStartRename(session, e)}
              className="p-1 rounded text-content-muted hover:text-content hover:bg-surface-sunken cursor-pointer"
              title="Rename conversation"
            >
              <EditIcon size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSessionToDelete(session.id);
              }}
              className="p-1 rounded text-content-muted hover:text-risk-text hover:bg-risk-bg cursor-pointer"
              title="Delete conversation"
            >
              <TrashIcon size={12} />
            </button>
          </div>
        </div>

        {/* Snippet preview if matched in message content */}
        {matchedSnippets.length > 0 && searchQuery && (
          <div className="pl-5.5 text-[11px] text-content-muted line-clamp-1 italic font-normal">
            &ldquo;{matchedSnippets[0]}&rdquo;
          </div>
        )}
      </div>
    );

  }
}

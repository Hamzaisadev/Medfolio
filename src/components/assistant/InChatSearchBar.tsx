import React, { useEffect, useRef } from 'react';
import { SearchIcon, XIcon, ChevronUpIcon, ChevronDownIcon } from '../ui/icons';

interface InChatSearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPrevMatch: () => void;
}

export function InChatSearchBar({
  isOpen,
  onClose,
  query,
  onQueryChange,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPrevMatch,
}: InChatSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onPrevMatch();
      } else {
        onNextMatch();
      }
    }
  };

  return (
    <div className="absolute top-3 right-4 sm:right-6 z-20 animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center gap-1.5 p-1.5 pl-3 bg-surface-raised/95 backdrop-blur-md border border-line-strong rounded-2xl shadow-card text-xs text-content">
        <SearchIcon size={14} className="text-content-subtle shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find in chat..."
          className="w-32 sm:w-48 bg-transparent text-xs text-content placeholder:text-content-subtle focus:outline-none"
        />

        {query && (
          <span className="text-[11px] font-semibold text-content-muted px-1 whitespace-nowrap">
            {matchCount > 0 ? `${currentMatchIndex} of ${matchCount}` : 'No matches'}
          </span>
        )}

        <div className="flex items-center gap-0.5 border-l border-line pl-1">
          <button
            type="button"
            onClick={onPrevMatch}
            disabled={matchCount === 0}
            className="p-1 rounded-lg hover:bg-surface-hover text-content-muted hover:text-content disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            title="Previous match (Shift+Enter)"
          >
            <ChevronUpIcon size={14} />
          </button>
          <button
            type="button"
            onClick={onNextMatch}
            disabled={matchCount === 0}
            className="p-1 rounded-lg hover:bg-surface-hover text-content-muted hover:text-content disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
            title="Next match (Enter)"
          >
            <ChevronDownIcon size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-hover text-content-muted hover:text-content ml-0.5 cursor-pointer"
            title="Close search (Esc)"
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Utility helper to highlight search occurrences in text.
 */
export function renderHighlightedText(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-amber-300 dark:bg-amber-500/40 text-inherit rounded-xs px-0.5 font-bold shadow-2xs"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

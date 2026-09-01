import React from 'react';

interface ChatMessageRendererProps {
  content: string;
  highlightQuery?: string;
  className?: string;
}

/**
 * Highlights any occurrences of the query inside a plain text chunk.
 */
function renderHighlightedPlain(text: string, query?: string): React.ReactNode {
  if (!query || !query.trim() || !text) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={i}
        className="bg-amber-300/80 dark:bg-amber-400/40 text-inherit rounded-xs px-0.5 font-bold shadow-2xs"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and highlights search terms.
 */
function renderInlineFormatting(text: string, query?: string): React.ReactNode {
  if (!text) return null;

  // Regex to split by inline tokens: **bold**, *italic*, `code`
  const tokenRegex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const inner = part.slice(2, -2);
      return (
        <strong key={idx} className="font-bold text-inherit">
          {renderInlineFormatting(inner, query)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <em key={idx} className="italic opacity-90">
          {renderInlineFormatting(inner, query)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const inner = part.slice(1, -1);
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded-md bg-surface-sunken border border-line font-mono text-xs text-accent font-semibold"
        >
          {renderHighlightedPlain(inner, query)}
        </code>
      );
    }

    return renderHighlightedPlain(part, query);
  });
}

/**
 * Renders chat messages with structured markdown-like blocks:
 * Headings (###), Bullet lists (- / *), Numbered lists (1.), and paragraphs.
 */
export function ChatMessageRenderer({
  content,
  highlightQuery,
  className = '',
}: ChatMessageRendererProps) {
  if (!content) return null;

  const rawLines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];
  let currentListType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (currentListItems.length > 0 && currentListType) {
      if (currentListType === 'ul') {
        blocks.push(
          <ul key={`ul-${blocks.length}`} className="list-disc list-outside pl-5 space-y-1 my-1.5">
            {currentListItems}
          </ul>
        );
      } else {
        blocks.push(
          <ol key={`ol-${blocks.length}`} className="list-decimal list-outside pl-5 space-y-1 my-1.5">
            {currentListItems}
          </ol>
        );
      }
      currentListItems = [];
      currentListType = null;
    }
  };

  rawLines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Empty lines act as paragraph separators
    if (!trimmed) {
      flushList();
      return;
    }

    // Heading 3: ### Heading
    if (trimmed.startsWith('### ')) {
      flushList();
      const title = trimmed.replace(/^###\s+/, '');
      blocks.push(
        <h4
          key={`h3-${lineIdx}`}
          className="font-bold text-xs sm:text-sm tracking-tight mt-2.5 mb-1"
        >
          {renderInlineFormatting(title, highlightQuery)}
        </h4>
      );
      return;
    }

    // Heading 2: ## Heading
    if (trimmed.startsWith('## ')) {
      flushList();
      const title = trimmed.replace(/^##\s+/, '');
      blocks.push(
        <h3
          key={`h2-${lineIdx}`}
          className="font-extrabold text-sm sm:text-base tracking-tight mt-3 mb-1.5"
        >
          {renderInlineFormatting(title, highlightQuery)}
        </h3>
      );
      return;
    }

    // Heading 1: # Heading
    if (trimmed.startsWith('# ')) {
      flushList();
      const title = trimmed.replace(/^#\s+/, '');
      blocks.push(
        <h2
          key={`h1-${lineIdx}`}
          className="font-black text-base sm:text-lg tracking-tight mt-3.5 mb-2"
        >
          {renderInlineFormatting(title, highlightQuery)}
        </h2>
      );
      return;
    }

    // Bullet List Item: - item, * item, • item
    const bulletMatch = trimmed.match(/^([-*•])\s+(.+)$/);
    if (bulletMatch && bulletMatch[2]) {
      if (currentListType && currentListType !== 'ul') {
        flushList();
      }
      currentListType = 'ul';
      currentListItems.push(
        <li key={`li-${lineIdx}`} className="leading-relaxed text-xs sm:text-sm">
          {renderInlineFormatting(bulletMatch[2], highlightQuery)}
        </li>
      );
      return;
    }

    // Numbered List Item: 1. item, 2. item
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (numMatch && numMatch[2]) {
      if (currentListType && currentListType !== 'ol') {
        flushList();
      }
      currentListType = 'ol';
      currentListItems.push(
        <li key={`ol-li-${lineIdx}`} className="leading-relaxed text-xs sm:text-sm">
          {renderInlineFormatting(numMatch[2], highlightQuery)}
        </li>
      );
      return;
    }

    // Regular paragraph / text line
    flushList();
    blocks.push(
      <p key={`p-${lineIdx}`} className="leading-relaxed text-xs sm:text-sm my-1">
        {renderInlineFormatting(line, highlightQuery)}
      </p>
    );
  });

  flushList();

  return <div className={`space-y-1 ${className}`}>{blocks}</div>;
}

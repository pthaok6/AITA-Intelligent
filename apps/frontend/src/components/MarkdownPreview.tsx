import React from 'react';

type InlinePart = { type: 'text' | 'code' | 'strong' | 'em' | 'link'; value: string; href?: string };

function parseInline(source: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^\s)]+\))/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: 'text', value: source.slice(cursor, index) });
    const token = match[0];
    if (token.startsWith('`')) parts.push({ type: 'code', value: token.slice(1, -1) });
    else if (token.startsWith('**') || token.startsWith('__')) parts.push({ type: 'strong', value: token.slice(2, -2) });
    else if (token.startsWith('*') || token.startsWith('_')) parts.push({ type: 'em', value: token.slice(1, -1) });
    else {
      const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(token);
      if (link) parts.push({ type: 'link', value: link[1], href: link[2] });
    }
    cursor = index + token.length;
  }
  if (cursor < source.length) parts.push({ type: 'text', value: source.slice(cursor) });
  return parts;
}

function renderInline(source: string): React.ReactNode[] {
  return parseInline(source).map((part, index) => {
    if (part.type === 'code') return <code key={index}>{part.value}</code>;
    if (part.type === 'strong') return <strong key={index}>{part.value}</strong>;
    if (part.type === 'em') return <em key={index}>{part.value}</em>;
    if (part.type === 'link') {
      try {
        const url = new URL(part.href!, window.location.href);
        if (url.protocol === 'http:' || url.protocol === 'https:') return <a key={index} href={url.href} target="_blank" rel="noreferrer">{part.value}</a>;
      } catch { /* Render unsafe or malformed links as plain text. */ }
      return <span key={index}>{part.value}</span>;
    }
    return <React.Fragment key={index}>{part.value}</React.Fragment>;
  });
}

export const MarkdownPreview: React.FC<{ content?: string; className?: string }> = ({ content = '', className = '' }) => {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={`p-${blocks.length}`}>{renderInline(paragraph.join(' '))}</p>);
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      const List = list.ordered ? 'ol' : 'ul';
      blocks.push(<List key={`list-${blocks.length}`}>{list.items.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</List>);
      list = null;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = /^\s*```/.test(line);
    if (fence) {
      flushParagraph(); flushList();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```/.test(lines[index])) code.push(lines[index++]);
      blocks.push(<pre key={`code-${blocks.length}`}><code>{code.join('\n')}</code></pre>);
      continue;
    }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      blocks.push(React.createElement(`h${level}`, { key: `h-${blocks.length}` }, renderInline(heading[2])));
      continue;
    }
    const item = /^\s*([-*+] |\d+\. )(.+)$/.exec(line);
    if (item) {
      flushParagraph();
      const ordered = /^\d/.test(item[1]);
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(item[2]);
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph(); flushList();
      blocks.push(<blockquote key={`q-${blocks.length}`}>{renderInline(quote[1])}</blockquote>);
      continue;
    }
    flushList(); paragraph.push(line.trim());
  }
  flushParagraph(); flushList();

  return <div className={`markdown-preview ${className}`.trim()}>{blocks.length ? blocks : <p className="markdown-preview-empty">Chưa có nội dung để xem trước.</p>}</div>;
};

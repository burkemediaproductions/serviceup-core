import React from 'react';

export function isRichTextDocument(value) {
  return !!(value && typeof value === 'object' && value.type === 'doc' && Array.isArray(value.content));
}

function nodeText(node) {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  return node.content.map(nodeText).join('');
}

export function richTextToPlainText(value, maxLength = 0) {
  if (!isRichTextDocument(value)) return '';
  const text = (value.content || [])
    .map(nodeText)
    .join(' ')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ' Embedded content ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return maxLength && text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function safeEmbedUrl(text) {
  const match = String(text || '').match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (!match) return '';
  try {
    const url = new URL(match[1]);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function TextNode({ node }) {
  let content = node.text || '';
  for (const mark of node.marks || []) {
    if (mark.type === 'bold') content = <strong>{content}</strong>;
    if (mark.type === 'italic') content = <em>{content}</em>;
    if (mark.type === 'underline') content = <u>{content}</u>;
    if (mark.type === 'code') content = <code>{content}</code>;
    if (mark.type === 'link' && /^https?:\/\//i.test(mark.attrs?.href || '')) {
      content = <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer">{content}</a>;
    }
  }
  return content;
}

function RenderNode({ node, index }) {
  if (!node) return null;
  if (node.type === 'text') return <TextNode node={node} />;
  if (node.type === 'hardBreak') return <br />;
  if (node.type === 'horizontalRule') return <hr />;

  const children = (node.content || []).map((child, i) => (
    <RenderNode key={`${index}-${i}`} node={child} index={`${index}-${i}`} />
  ));

  if (node.type === 'paragraph') {
    const embedUrl = safeEmbedUrl(nodeText(node));
    if (embedUrl) {
      return (
        <div className="su-rich-preview-embed">
          <iframe src={embedUrl} title="Embedded content" loading="lazy" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        </div>
      );
    }
    return <p>{children}</p>;
  }
  if (node.type === 'heading') {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2));
    return React.createElement(`h${level}`, null, children);
  }
  if (node.type === 'bulletList') return <ul>{children}</ul>;
  if (node.type === 'orderedList') return <ol start={node.attrs?.start || 1}>{children}</ol>;
  if (node.type === 'listItem') return <li>{children}</li>;
  if (node.type === 'blockquote') return <blockquote>{children}</blockquote>;
  if (node.type === 'codeBlock') return <pre><code>{nodeText(node)}</code></pre>;
  return <>{children}</>;
}

export default function RichTextContent({ value, compact = false }) {
  if (!isRichTextDocument(value)) return null;
  return (
    <div className={`su-rich-preview${compact ? ' su-rich-preview--compact' : ''}`}>
      {(value.content || []).map((node, i) => <RenderNode key={i} node={node} index={i} />)}
    </div>
  );
}

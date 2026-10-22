// Markdown mínimo y seguro (se escapa todo el HTML antes de transformar).
import { t } from '../../shared/i18n/index.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s) {
  // `código`
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, u) => `<a href="${u}" data-ext>${label}</a>`);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre, u) => `${pre}<a href="${u}" data-ext>${u}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  // eslint-disable-next-line no-control-regex -- \u0000 delimita los trozos de código ya escapados
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
  return s;
}

export function renderMarkdown(src) {
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    para = [];
  };
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^\s*```\s*([\w+-]*)/);
    if (fence) {
      flush();
      const lang = fence[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(
        `<div class="code"><div class="code-head"><span>${esc(lang || t('md.code'))}</span><button class="copy" data-copy>${esc(t('md.copy'))}</button></div><pre><code>${esc(buf.join('\n'))}</code></pre></div>`,
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      flush();
      out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`);
      i++;
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const ordered = /^\s*\d/.test(line);
      const items = [];
      while (i < lines.length && (/^\s*[-*+]\s+/.test(lines[i]) || /^\s*\d+[.)]\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</${tag}>`);
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flush();
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${buf.map(inline).join('<br>')}</blockquote>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flush();
      const row = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = row(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(row(lines[i++]));
      out.push(
        `<div class="table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    if (!line.trim()) {
      flush();
      i++;
      continue;
    }
    para.push(line);
    i++;
  }
  flush();
  return out.join('');
}

export const escapeHtml = esc;

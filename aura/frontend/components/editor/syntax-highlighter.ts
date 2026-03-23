/**
 * Lightweight syntax highlighter — regex-based.
 * Returns an array of spans with CSS classes.
 * Supports: Python, TypeScript/JS, JSON, CSS, HTML, Markdown, Bash, SQL.
 */

export type HighlightSpan = {
  text: string;
  className: string;
};

type Rule = {
  pattern: RegExp;
  className: string;
};

const PYTHON_RULES: Rule[] = [
  { pattern: /#.*/g, className: 'text-zinc-500 italic' },
  { pattern: /("""[\s\S]*?"""|'''[\s\S]*?''')/g, className: 'text-green-400' },
  { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, className: 'text-green-400' },
  { pattern: /\b(def|class|import|from|return|if|elif|else|for|while|try|except|finally|with|as|yield|raise|pass|break|continue|and|or|not|in|is|lambda|async|await|None|True|False|self)\b/g, className: 'text-purple-400' },
  { pattern: /\b(int|str|float|bool|list|dict|tuple|set|Optional|Any|Union)\b/g, className: 'text-cyan-400' },
  { pattern: /@\w+/g, className: 'text-yellow-400' },
  { pattern: /\b\d+\.?\d*\b/g, className: 'text-orange-400' },
];

const TS_RULES: Rule[] = [
  { pattern: /\/\/.*/g, className: 'text-zinc-500 italic' },
  { pattern: /\/\*[\s\S]*?\*\//g, className: 'text-zinc-500 italic' },
  { pattern: /(`(?:[^`\\]|\\.)*`)/g, className: 'text-green-400' },
  { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, className: 'text-green-400' },
  { pattern: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|void|throw|try|catch|finally|class|extends|import|export|from|default|as|async|await|yield|of|in|type|interface|enum|namespace|declare|readonly|abstract|implements|super|this|null|undefined|true|false)\b/g, className: 'text-purple-400' },
  { pattern: /\b(string|number|boolean|any|void|never|unknown|object|Record|Partial|Required|Promise|Array)\b/g, className: 'text-cyan-400' },
  { pattern: /\b\d+\.?\d*\b/g, className: 'text-orange-400' },
];

const JSON_RULES: Rule[] = [
  { pattern: /("(?:[^"\\]|\\.)*")\s*:/g, className: 'text-blue-400' },
  { pattern: /"(?:[^"\\]|\\.)*"/g, className: 'text-green-400' },
  { pattern: /\b(true|false|null)\b/g, className: 'text-purple-400' },
  { pattern: /\b-?\d+\.?\d*\b/g, className: 'text-orange-400' },
];

const CSS_RULES: Rule[] = [
  { pattern: /\/\*[\s\S]*?\*\//g, className: 'text-zinc-500 italic' },
  { pattern: /([.#][\w-]+)/g, className: 'text-yellow-400' },
  { pattern: /([\w-]+)\s*:/g, className: 'text-blue-400' },
  { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, className: 'text-green-400' },
  { pattern: /\b\d+\.?\d*(px|rem|em|%|vh|vw|s|ms)?\b/g, className: 'text-orange-400' },
];

const MD_RULES: Rule[] = [
  { pattern: /^#{1,6}\s.*/gm, className: 'text-blue-400 font-bold' },
  { pattern: /\*\*.*?\*\*/g, className: 'text-zinc-200 font-bold' },
  { pattern: /\*.*?\*/g, className: 'text-zinc-300 italic' },
  { pattern: /`[^`]+`/g, className: 'text-green-400' },
  { pattern: /\[.*?\]\(.*?\)/g, className: 'text-blue-400 underline' },
];

const BASH_RULES: Rule[] = [
  { pattern: /#.*/g, className: 'text-zinc-500 italic' },
  { pattern: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, className: 'text-green-400' },
  { pattern: /\b(if|then|else|elif|fi|for|do|done|while|case|esac|function|return|exit|echo|export|source|alias|cd|ls|grep|find|cat|sed|awk|rm|cp|mv|mkdir)\b/g, className: 'text-purple-400' },
  { pattern: /\$\w+/g, className: 'text-cyan-400' },
  { pattern: /\$\{[^}]+\}/g, className: 'text-cyan-400' },
];

const RULES_MAP: Record<string, Rule[]> = {
  python: PYTHON_RULES,
  typescript: TS_RULES,
  tsx: TS_RULES,
  javascript: TS_RULES,
  jsx: TS_RULES,
  json: JSON_RULES,
  css: CSS_RULES,
  markdown: MD_RULES,
  bash: BASH_RULES,
};

/**
 * Highlight a single line of code.
 * Returns the line with <span> wrappers for colored segments.
 * Uses HTML-escaped text.
 */
export function highlightLine(line: string, language: string): string {
  const escaped = escapeHtml(line);
  const rules = RULES_MAP[language];
  if (!rules) return escaped;

  // Apply rules in order, marking regions
  type Region = { start: number; end: number; className: string };
  const regions: Region[] = [];

  for (const rule of rules) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      // Check no overlap with higher-priority regions
      const overlaps = regions.some(
        (r) => start < r.end && end > r.start,
      );
      if (!overlaps) {
        regions.push({ start, end, className: rule.className });
      }
    }
  }

  if (regions.length === 0) return escaped;

  // Sort by start position
  regions.sort((a, b) => a.start - b.start);

  // Build result
  let result = '';
  let pos = 0;
  for (const region of regions) {
    if (region.start > pos) {
      result += escapeHtml(line.slice(pos, region.start));
    }
    result += `<span class="${region.className}">${escapeHtml(line.slice(region.start, region.end))}</span>`;
    pos = region.end;
  }
  if (pos < line.length) {
    result += escapeHtml(line.slice(pos));
  }

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

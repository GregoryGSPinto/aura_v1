/**
 * ANSI Parser — Converte strings com ANSI escape codes em spans HTML.
 *
 * Suporta cores básicas: vermelho (erro), verde (sucesso), amarelo (warning),
 * azul (info), branco (normal), cinza (dim), magenta, cyan.
 */

export type AnsiSpan = {
  text: string;
  className: string;
};

const ANSI_REGEX = /\x1b\[([0-9;]*)m/g;

const COLOR_MAP: Record<string, string> = {
  "30": "text-zinc-900",
  "31": "text-red-400",
  "32": "text-green-400",
  "33": "text-yellow-400",
  "34": "text-blue-400",
  "35": "text-purple-400",
  "36": "text-cyan-400",
  "37": "text-zinc-300",
  "90": "text-zinc-500",
  "91": "text-red-300",
  "92": "text-green-300",
  "93": "text-yellow-300",
  "94": "text-blue-300",
  "95": "text-purple-300",
  "96": "text-cyan-300",
  "97": "text-white",
  "1": "font-bold",
  "2": "opacity-60",
  "3": "italic",
  "4": "underline",
};

export function parseAnsi(input: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  let currentClasses: string[] = [];
  let lastIndex = 0;

  ANSI_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ANSI_REGEX.exec(input)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      const text = input.slice(lastIndex, match.index);
      if (text) {
        spans.push({
          text,
          className: currentClasses.join(" ") || "text-zinc-300",
        });
      }
    }

    // Parse the codes
    const codes = match[1].split(";").filter(Boolean);
    for (const code of codes) {
      if (code === "0" || code === "") {
        currentClasses = [];
      } else if (COLOR_MAP[code]) {
        // Remove previous color class if adding a new text-* class
        if (COLOR_MAP[code].startsWith("text-")) {
          currentClasses = currentClasses.filter((c) => !c.startsWith("text-"));
        }
        currentClasses.push(COLOR_MAP[code]);
      }
    }

    lastIndex = ANSI_REGEX.lastIndex;
  }

  // Add remaining text
  if (lastIndex < input.length) {
    spans.push({
      text: input.slice(lastIndex),
      className: currentClasses.join(" ") || "text-zinc-300",
    });
  }

  // If no spans, return the original text
  if (spans.length === 0 && input) {
    spans.push({ text: input, className: "text-zinc-300" });
  }

  return spans;
}

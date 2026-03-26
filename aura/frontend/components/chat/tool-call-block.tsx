'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, FileText, GitBranch, Globe, FolderOpen, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ToolCallData {
  tool: string;
  params: Record<string, unknown>;
  result: {
    tool: string;
    status: string;
    duration_ms: number | null;
    output: unknown;
    error: string | null;
    risk_level: string;
  };
}

const TOOL_ICONS: Record<string, typeof Terminal> = {
  terminal: Terminal,
  git: GitBranch,
  filesystem: FolderOpen,
  browser: Globe,
  doc: FileText,
};

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  executed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  blocked: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  needs_approval: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
} as const;

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.failed;
}

function formatOutput(output: unknown): string {
  if (output === null || output === undefined) return '';
  if (typeof output === 'string') return output;
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

function getToolCategory(toolName: string): string {
  return toolName.split('.')[0] || toolName;
}

export function ToolCallBlock({ toolCall }: { toolCall: ToolCallData }) {
  const [expanded, setExpanded] = useState(false);
  const { result } = toolCall;
  const category = getToolCategory(toolCall.tool);
  const Icon = TOOL_ICONS[category] ?? Terminal;
  const config = getStatusConfig(result.status);
  const StatusIcon = config.icon;
  const output = formatOutput(result.output);
  const hasOutput = output.length > 0;
  const hasError = !!result.error;
  const displayText = hasError ? result.error : output;
  const isLong = (displayText?.length ?? 0) > 200;

  // Format params for display
  const paramsDisplay = Object.entries(toolCall.params)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(', ');

  return (
    <div className={cn('my-2 rounded-lg border p-2.5', config.bg)}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <span className="flex-1 truncate text-xs font-medium text-zinc-300">
          {toolCall.tool}
          {paramsDisplay && (
            <span className="ml-1 font-normal text-zinc-500">({paramsDisplay})</span>
          )}
        </span>
        <StatusIcon className={cn('h-3.5 w-3.5 shrink-0', config.color)} />
        {result.duration_ms != null && (
          <span className="text-[10px] tabular-nums text-zinc-600">{result.duration_ms}ms</span>
        )}
        {(hasOutput || hasError) && (
          expanded
            ? <ChevronDown className="h-3 w-3 text-zinc-600" />
            : <ChevronRight className="h-3 w-3 text-zinc-600" />
        )}
      </button>

      {expanded && displayText && (
        <pre className={cn(
          'mt-2 max-h-60 overflow-auto rounded-md bg-black/30 p-2 text-[11px] leading-relaxed',
          hasError ? 'text-red-300' : 'text-zinc-400',
        )}>
          {isLong ? displayText.slice(0, 2000) : displayText}
          {displayText.length > 2000 && '\n... (truncated)'}
        </pre>
      )}

      {/* Auto-show short output without needing to expand */}
      {!expanded && hasOutput && !isLong && !hasError && (
        <div className="mt-1.5 truncate text-[11px] text-zinc-500">
          {output.split('\n')[0]?.slice(0, 120)}
        </div>
      )}
    </div>
  );
}

export function ToolCallList({ toolCalls }: { toolCalls: ToolCallData[] }) {
  if (!toolCalls?.length) return null;
  return (
    <div className="mt-1 space-y-1">
      {toolCalls.map((tc, i) => (
        <ToolCallBlock key={`${tc.tool}-${i}`} toolCall={tc} />
      ))}
    </div>
  );
}

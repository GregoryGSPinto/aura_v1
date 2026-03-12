'use client';

import { FileText, LoaderCircle, Paperclip, TriangleAlert, X } from 'lucide-react';

import type { AttachmentPreview } from '@/lib/chat-types';
import { formatBytes } from '@/lib/utils';

export function AttachmentControls({
  attachments,
  onRemove,
}: {
  attachments: AttachmentPreview[];
  onRemove: (attachmentId: string) => void;
}) {
  if (!attachments.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex min-w-[180px] max-w-full items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.05] px-3 py-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04]">
            {attachment.status === 'uploading' ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-[var(--accent-cyan)]" />
            ) : attachment.status === 'error' ? (
              <TriangleAlert className="h-4 w-4 text-[var(--error)]" />
            ) : (
              <FileText className="h-4 w-4 text-[var(--accent-cyan)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">{attachment.name}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {attachment.status === 'ready' ? formatBytes(attachment.size) : attachment.error || 'Preparando anexo'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            aria-label={`Remover ${attachment.name}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AttachmentButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-[var(--text-secondary)] transition hover:bg-white/[0.08] hover:text-[var(--text-primary)]"
      aria-label="Adicionar arquivo"
    >
      <Paperclip className="h-4 w-4" />
    </button>
  );
}

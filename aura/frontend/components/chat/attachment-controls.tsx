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
          className="flex items-center gap-2 rounded-lg border border-white/5 bg-zinc-800 px-3 py-2"
        >
          <div className="shrink-0">
            {attachment.status === 'uploading' ? (
              <LoaderCircle className="h-4 w-4 animate-spin text-blue-400" />
            ) : attachment.status === 'error' ? (
              <TriangleAlert className="h-4 w-4 text-red-400" />
            ) : (
              <FileText className="h-4 w-4 text-zinc-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-300">{attachment.name}</p>
            <p className="text-[11px] text-zinc-600">
              {attachment.status === 'ready' ? formatBytes(attachment.size) : attachment.error || 'Preparando...'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(attachment.id)}
            className="rounded p-0.5 text-zinc-600 transition hover:text-zinc-400"
            aria-label={`Remover ${attachment.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AttachmentButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition hover:bg-white/5 hover:text-zinc-400"
      aria-label="Adicionar arquivo"
    >
      <Paperclip className="h-4 w-4" />
    </button>
  );
}

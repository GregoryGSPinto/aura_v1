'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Copy, FileText, MessageSquare, X } from 'lucide-react';

function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sharedData, setSharedData] = useState<{
    title?: string;
    text?: string;
    url?: string;
  }>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSharedData({
      title: searchParams?.get('title') || undefined,
      text: searchParams?.get('text') || undefined,
      url: searchParams?.get('url') || undefined,
    });
  }, [searchParams]);

  const content = [sharedData.title, sharedData.text, sharedData.url].filter(Boolean).join('\n');

  const sendToChat = () => {
    const message = [sharedData.text, sharedData.url].filter(Boolean).join('\n');
    sessionStorage.setItem('aura_shared_message', message);
    router.push('/chat');
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  if (!content) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
        <div className="text-center">
          <p className="text-zinc-400">Nenhum conteúdo compartilhado.</p>
          <button
            type="button"
            onClick={() => router.push('/chat')}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
          >
            Ir pro Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-lg font-semibold text-zinc-100">
          Compartilhado com Aura
        </h1>

        <div className="rounded-xl border border-white/5 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-300 line-clamp-6 whitespace-pre-wrap">{content}</p>
        </div>

        <p className="text-center text-sm text-zinc-500">O que fazer?</p>

        <div className="space-y-2">
          <button
            type="button"
            onClick={sendToChat}
            className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 transition active:bg-white/5"
          >
            <MessageSquare className="h-5 w-5 text-blue-400" />
            Enviar pro Chat
          </button>

          <button
            type="button"
            onClick={copyToClipboard}
            className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 transition active:bg-white/5"
          >
            <Copy className="h-5 w-5 text-green-400" />
            {copied ? 'Copiado!' : 'Copiar'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/chat')}
            className="flex w-full items-center gap-3 rounded-xl border border-white/5 bg-zinc-900 px-4 py-3 text-sm text-zinc-400 transition active:bg-white/5"
          >
            <X className="h-5 w-5" />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-zinc-500">Carregando...</div>}>
      <ShareContent />
    </Suspense>
  );
}

import Link from 'next/link';
import { ArrowRight, MessageSquareText, Sparkles } from 'lucide-react';

export default function HomePage() {
  return (
    <section className="flex h-full items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-900">
          <Sparkles className="h-6 w-6 text-zinc-400" />
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Aura
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          Assistente pessoal com IA local, pronto para conversar.
        </p>

        <Link
          href="/chat"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          <MessageSquareText className="h-4 w-4" />
          Abrir chat
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

'use client';

import { motion } from 'framer-motion';
import { haptic } from '@/hooks/use-haptic';

type ChipAction = 'message' | 'terminal' | 'tab' | 'file';

type Chip = {
  icon: string;
  label: string;
  action: ChipAction;
  value: string;
};

function generateChips(auraResponse: string): Chip[] {
  const chips: Chip[] = [];
  const lower = auraResponse.toLowerCase();

  if (lower.includes('erro') || lower.includes('falhou') || lower.includes('error') || lower.includes('failed')) {
    chips.push({ icon: '🔍', label: 'Ver detalhes', action: 'message', value: 'Mostra o erro completo' });
    chips.push({ icon: '🔄', label: 'Tentar de novo', action: 'message', value: 'Tenta de novo' });
  }

  if (lower.includes('deploy') || lower.includes('vercel')) {
    chips.push({ icon: '📋', label: 'Ver logs', action: 'message', value: 'Mostra os logs do deploy' });
    chips.push({ icon: '🌐', label: 'Abrir preview', action: 'tab', value: 'dashboard' });
  }

  if (lower.includes('test') || lower.includes('pytest') || lower.includes('jest')) {
    chips.push({ icon: '▶️', label: 'Rodar testes', action: 'message', value: 'Roda os testes' });
    chips.push({ icon: '📋', label: 'Ver resultado', action: 'message', value: 'Mostra o resultado dos testes' });
  }

  if (lower.includes('commit') || lower.includes('push') || lower.includes('git')) {
    chips.push({ icon: '📊', label: 'Git status', action: 'message', value: 'Git status' });
    chips.push({ icon: '🔀', label: 'Ver diff', action: 'message', value: 'Mostra o git diff' });
  }

  if (lower.includes('arquivo') || lower.includes('file') || /\w+\.\w{2,4}/.test(lower)) {
    const fileMatch = auraResponse.match(/[\w/.-]+\.\w{2,4}/);
    if (fileMatch) {
      chips.push({ icon: '📄', label: 'Abrir', action: 'message', value: `Abra o arquivo ${fileMatch[0]}` });
    }
  }

  // Fill with generics up to at least 3
  const generics: Chip[] = [
    { icon: '📊', label: 'Status geral', action: 'message', value: 'Status geral de tudo' },
    { icon: '💡', label: 'Sugestões', action: 'message', value: 'O que você sugere fazer agora?' },
    { icon: '➡️', label: 'Continuar', action: 'message', value: 'Continua' },
  ];

  for (const generic of generics) {
    if (chips.length >= 3) break;
    if (!chips.find((c) => c.label === generic.label)) {
      chips.push(generic);
    }
  }

  return chips.slice(0, 4);
}

export function SmartChips({
  lastAssistantMessage,
  onSendMessage,
  visible,
}: {
  lastAssistantMessage: string;
  onSendMessage: (text: string) => void;
  visible: boolean;
}) {
  if (!visible || !lastAssistantMessage) return null;

  const chips = generateChips(lastAssistantMessage);

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-none">
      {chips.map((chip, i) => (
        <motion.button
          key={chip.label}
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
          onClick={() => {
            haptic.light();
            onSendMessage(chip.value);
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 transition active:scale-95 active:bg-white/5"
        >
          <span>{chip.icon}</span>
          <span>{chip.label}</span>
        </motion.button>
      ))}
    </div>
  );
}

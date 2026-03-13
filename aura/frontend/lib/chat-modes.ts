'use client';

export type AuraChatModeId =
  | 'aura-5-1'
  | 'aura-5-3'
  | 'aura-5-4'
  | 'aura-fast'
  | 'aura-deep'
  | 'aura-research';

export type AuraChatMode = {
  id: AuraChatModeId;
  label: string;
  shortLabel: string;
  description: string;
  capability: 'general' | 'fast' | 'deep' | 'research';
  request: {
    temperature: number;
    think: boolean;
  };
};

export const AURA_CHAT_MODES: AuraChatMode[] = [
  {
    id: 'aura-5-1',
    label: 'Aura 5.1',
    shortLabel: '5.1',
    description: 'Equilibrada para conversa, contexto e execução segura.',
    capability: 'general',
    request: { temperature: 0.45, think: false },
  },
  {
    id: 'aura-5-3',
    label: 'Aura 5.3',
    shortLabel: '5.3',
    description: 'Mais contexto operacional e respostas mais polidas.',
    capability: 'general',
    request: { temperature: 0.35, think: true },
  },
  {
    id: 'aura-5-4',
    label: 'Aura 5.4',
    shortLabel: '5.4',
    description: 'Perfil premium para sessões estratégicas e multitarefa.',
    capability: 'general',
    request: { temperature: 0.3, think: true },
  },
  {
    id: 'aura-fast',
    label: 'Aura Rápida',
    shortLabel: 'Rápida',
    description: 'Menor latência para perguntas curtas e iteração rápida.',
    capability: 'fast',
    request: { temperature: 0.2, think: false },
  },
  {
    id: 'aura-deep',
    label: 'Aura Profunda',
    shortLabel: 'Profunda',
    description: 'Mais análise e encadeamento para decisões complexas.',
    capability: 'deep',
    request: { temperature: 0.25, think: true },
  },
  {
    id: 'aura-research',
    label: 'Aura Pesquisa',
    shortLabel: 'Pesquisa',
    description: 'Prepara respostas mais analíticas e orientadas a investigação.',
    capability: 'research',
    request: { temperature: 0.15, think: true },
  },
];

export const DEFAULT_AURA_CHAT_MODE_ID: AuraChatModeId = 'aura-5-4';

export function getAuraChatMode(modeId?: string | null) {
  return (
    AURA_CHAT_MODES.find((mode) => mode.id === modeId) ??
    AURA_CHAT_MODES.find((mode) => mode.id === DEFAULT_AURA_CHAT_MODE_ID)!
  );
}

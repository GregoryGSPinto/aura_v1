import {
  AudioLines,
  Blocks,
  BrainCircuit,
  FolderKanban,
  House,
  MessageSquareText,
  Settings2,
  ShieldCheck,
  Telescope,
  Wrench,
} from "lucide-react";

export const auraNavigation = [
  {
    title: "Presenca",
    items: [
      { href: "/", label: "Home", icon: House, description: "Momento, foco e contexto" },
      { href: "/chat", label: "Conversa", icon: MessageSquareText, description: "Dialogo operacional" },
    ],
  },
  {
    title: "Capacidades",
    items: [
      { href: "/swarm", label: "Rotinas", icon: Blocks, description: "Jobs e execucao assistida" },
      { href: "/projects", label: "Projetos", icon: FolderKanban, description: "Projetos em foco" },
      { href: "/remote", label: "Ferramentas", icon: Wrench, description: "Superficies acionaveis" },
      { href: "/system", label: "Operacao", icon: ShieldCheck, description: "Telemetria e confianca" },
    ],
  },
  {
    title: "Contexto",
    items: [
      { href: "/memory", label: "Memoria", icon: BrainCircuit, description: "Contexto governado e preferencias" },
      { href: "/chat", label: "Research", icon: Telescope, description: "Busca e sintese orientada" },
      { href: "/trust", label: "Trust", icon: ShieldCheck, description: "Auditoria, limites e transparencia" },
      { href: "/settings", label: "Voz", icon: AudioLines, description: "Runtime e presenca falada" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/settings", label: "Configuracoes", icon: Settings2, description: "Preferencias e ambiente" },
    ],
  },
] as const;

export const auraPageMeta: Record<string, { eyebrow: string; title: string; description: string; accent: string }> = {
  "/": {
    eyebrow: "Aura Presence",
    title: "Ambiente operacional pessoal",
    description: "Contexto, memoria e acoes do momento em uma superficie calma e precisa.",
    accent: "core",
  },
  "/chat": {
    eyebrow: "Conversation Runtime",
    title: "Conversa com a Aura",
    description: "Dialogo refinado com contexto, operacao e sugestoes acionaveis.",
    accent: "conversation",
  },
  "/projects": {
    eyebrow: "Project Surface",
    title: "Projetos em foco",
    description: "Catálogo operacional com acesso rapido ao workspace e estado de execucao.",
    accent: "project",
  },
  "/system": {
    eyebrow: "Operational Trust",
    title: "Saude do sistema",
    description: "Readiness, servicos e sinais de confianca do runtime atual.",
    accent: "system",
  },
  "/settings": {
    eyebrow: "Personalization",
    title: "Preferencias e ambiente",
    description: "Configuracao pessoal, visual e operacional da experiencia Aura.",
    accent: "settings",
  },
  "/swarm": {
    eyebrow: "Automation",
    title: "Rotinas e jobs",
    description: "Planejamento estruturado e execucao assistida com trilha de estado.",
    accent: "automation",
  },
  "/remote": {
    eyebrow: "Action Surface",
    title: "Ferramentas e controle",
    description: "Acoes assistidas em superfícies reais com controle e rastreabilidade.",
    accent: "tools",
  },
  "/memory": {
    eyebrow: "Memory Governance",
    title: "Memoria e continuidade",
    description: "O que a Aura lembra, por que lembra e como isso melhora a continuidade.",
    accent: "memory",
  },
  "/trust": {
    eyebrow: "Trust Dashboard",
    title: "Transparencia e governanca",
    description: "Visibilidade sobre memoria ativa, sinais de seguranca e trilha operacional.",
    accent: "trust",
  },
};

export const auraQuickPrompts = [
  "Organize meu foco operacional de hoje",
  "Qual e o estado real da Aura agora",
  "Quais projetos merecem atencao imediata",
  "Resuma memoria e proximas acoes desta sessao",
] as const;

export const auraMoodCopy = {
  morning: "Bom dia. O ambiente esta pronto para iniciar com clareza.",
  afternoon: "Boa tarde. A Aura esta sincronizada e pronta para sustentar o ritmo.",
  evening: "Boa noite. O contexto do dia pode ser encerrado com menos friccao.",
};

"use client";

import { ArrowUpRight, Bot, Command, FolderOpen, LoaderCircle, Sparkles, TerminalSquare } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { clientEnv, getClientEnvWarnings, isSupabaseClientConfigured } from "@/lib/env";
import { cancelAgentJob, createAgentJob, fetchAgentJob, fetchAgentJobs, fetchProjects, fetchStatus, openProject, sendChat, startAgentJob } from "@/lib/api";
import type { AgentJobDetail, AgentJobSummary, Project, StatusPayload } from "@/lib/types";

type Message = {
  role: "user" | "assistant";
  content: string;
  meta?: string;
};

const quickActions = [
  { label: "Listar projetos", prompt: "Quais projetos estão disponíveis agora?" },
  { label: "Saúde do sistema", prompt: "Me dê um resumo do status operacional da Aura." },
  { label: "Git do workspace", prompt: "Quero o status do git do projeto principal." },
];

export function AuraShell() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Sou a Aura. Posso responder, mostrar o estado do sistema e acionar operações controladas no seu Mac.",
      meta: "Pronta para assistência operacional",
    },
  ]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openingProject, setOpeningProject] = useState<string | null>(null);
  const [jobGoal, setJobGoal] = useState("");
  const [jobs, setJobs] = useState<AgentJobSummary[]>([]);
  const [selectedJob, setSelectedJob] = useState<AgentJobDetail | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const envWarnings = getClientEnvWarnings();
  const supabaseClientReady = isSupabaseClientConfigured();

  useEffect(() => {
    startTransition(() => {
      Promise.all([fetchStatus(), fetchProjects(), fetchAgentJobs()])
        .then(([statusResponse, projectResponse, jobsResponse]) => {
          setStatus(statusResponse.data);
          setProjects(projectResponse.data.projects);
          setJobs(jobsResponse.data.jobs);
        })
        .catch((loadError: Error) => {
          setError(loadError.message);
        });
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchAgentJobs()
        .then((response) => setJobs(response.data.jobs))
        .catch(() => undefined);
      if (selectedJob?.id) {
        fetchAgentJob(selectedJob.id)
          .then((response) => setSelectedJob(response.data))
          .catch(() => undefined);
      }
    }, 3000);

    return () => window.clearInterval(timer);
  }, [selectedJob?.id]);

  async function handleSubmit(prompt?: string) {
    const content = (prompt ?? input).trim();
    if (!content) return;

    setError(null);
    const history = messages.map(({ role, content: messageContent }) => ({ role, content: messageContent }));
    setMessages((current) => [...current, { role: "user", content }]);
    setInput("");

    startTransition(() => {
      sendChat(content, history)
        .then((response) => {
          const payload = response.data;
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: payload.response,
              meta: `${payload.intent} · ${payload.processing_time_ms} ms`,
            },
          ]);
        })
        .catch((chatError: Error) => {
          setError(chatError.message);
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: "Não consegui concluir essa resposta agora. Verifique a API e o Ollama local.",
              meta: "Falha operacional",
            },
          ]);
        });
    });
  }

  async function handleOpenProject(name: string) {
    setOpeningProject(name);
    setError(null);
    try {
      const response = await openProject(name);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: response.data.message,
          meta: `Ação executada · ${response.data.opened_in}`,
        },
      ]);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Falha ao abrir o projeto.");
    } finally {
      setOpeningProject(null);
    }
  }

  async function handleCreateJob() {
    const goal = jobGoal.trim();
    if (!goal) return;

    setIsCreatingJob(true);
    setError(null);
    try {
      const response = await createAgentJob(goal, undefined, false);
      const detail = await fetchAgentJob(response.data.job_id);
      setSelectedJob(detail.data);
      setJobGoal("");
      const jobsResponse = await fetchAgentJobs();
      setJobs(jobsResponse.data.jobs);
    } catch (jobError) {
      setError(jobError instanceof Error ? jobError.message : "Falha ao criar job.");
    } finally {
      setIsCreatingJob(false);
    }
  }

  async function handleStartJob(jobId: string) {
    setError(null);
    try {
      const response = await startAgentJob(jobId);
      setSelectedJob(response.data);
      const jobsResponse = await fetchAgentJobs();
      setJobs(jobsResponse.data.jobs);
    } catch (jobError) {
      setError(jobError instanceof Error ? jobError.message : "Falha ao iniciar job.");
    }
  }

  async function handleCancelJob(jobId: string) {
    setError(null);
    try {
      const response = await cancelAgentJob(jobId);
      setSelectedJob(response.data);
      const jobsResponse = await fetchAgentJobs();
      setJobs(jobsResponse.data.jobs);
    } catch (jobError) {
      setError(jobError instanceof Error ? jobError.message : "Falha ao cancelar job.");
    }
  }

  return (
    <main className="min-h-screen bg-aura-base text-aura-text">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(114,224,166,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(104,205,231,0.16),transparent_28%),linear-gradient(180deg,#0b1020_0%,#11182d_52%,#0a0f1d_100%)]" />
      <div className="absolute inset-0 -z-10 bg-grid bg-[size:48px_48px] opacity-[0.08]" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:flex-row lg:px-8">
        <aside className="w-full shrink-0 space-y-4 lg:w-[320px]">
          <div className="rounded-[28px] border border-aura-line bg-white/5 p-5 shadow-aura backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-3xl tracking-tight">Aura</p>
                <p className="mt-1 text-sm text-aura-muted">Assistente operacional pessoal para o seu Mac.</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 p-2">
                <Sparkles className="h-5 w-5 text-aura-glow" />
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl border border-white/8 bg-aura-panel p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-aura-muted">Sistema</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm">{status?.status ?? "carregando"}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${status?.services.llm === "online" ? "bg-aura-accent" : "bg-red-400"}`} />
                </div>
                <p className="mt-3 text-sm text-aura-muted">Modelo ativo: {status?.model ?? "qwen3.5:9b"}</p>
                <p className="mt-2 text-sm text-aura-muted">
                  Persistência: {status?.persistence.mode ?? "local"} · Auth: {status?.auth_mode ?? clientEnv.auraEnv}
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-aura-panel p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-aura-muted">Ações rápidas</p>
                <div className="mt-3 space-y-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => void handleSubmit(action.prompt)}
                      className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-3 py-3 text-left text-sm transition hover:border-aura-accent/60 hover:bg-white/10"
                    >
                      {action.label}
                      <ArrowUpRight className="h-4 w-4 text-aura-muted" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-aura-panel p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-aura-muted">Cloud readiness</p>
                <div className="mt-3 space-y-2 text-sm text-aura-muted">
                  <p>Ambiente: {clientEnv.auraEnv}</p>
                  <p>API: {clientEnv.apiUrl || "não configurada"}</p>
                  <p>Supabase client: {supabaseClientReady ? "configurado" : "não configurado"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-aura-line bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-aura-accent" />
              <p className="text-sm font-medium">Projetos</p>
            </div>
            <div className="mt-4 space-y-3">
              {projects.map((project) => (
                <button
                  key={project.name}
                  onClick={() => void handleOpenProject(project.name)}
                  className="w-full rounded-2xl border border-white/8 bg-aura-panelSoft p-4 text-left transition hover:border-aura-accent/60"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{project.name}</p>
                      <p className="mt-1 truncate text-xs text-aura-muted">{project.description || project.path}</p>
                    </div>
                    {openingProject === project.name ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-aura-accent" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-aura-muted" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-aura-line bg-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Agent Mode</p>
              <span className="text-xs text-aura-muted">{status?.jobs?.running ?? 0} rodando</span>
            </div>
            <div className="mt-4 space-y-3">
              <textarea
                value={jobGoal}
                onChange={(event) => setJobGoal(event.target.value)}
                rows={4}
                placeholder="Ex: Abra o projeto aura_v1 e verifique o git status."
                className="w-full resize-none rounded-2xl border border-white/8 bg-aura-panel px-4 py-3 text-sm text-aura-text outline-none transition placeholder:text-aura-muted focus:border-aura-accent/70"
              />
              <button
                onClick={() => void handleCreateJob()}
                disabled={isCreatingJob}
                className="w-full rounded-2xl border border-aura-accent/40 bg-aura-accent/10 px-4 py-3 text-sm font-medium text-aura-text transition hover:border-aura-accent/80 hover:bg-aura-accent/15 disabled:opacity-60"
              >
                {isCreatingJob ? "Planejando..." : "Criar Job"}
              </button>
              <div className="space-y-2">
                {jobs.slice(0, 4).map((job) => (
                  <button
                    key={job.id}
                    onClick={() => void fetchAgentJob(job.id).then((response) => setSelectedJob(response.data)).catch(() => undefined)}
                    className="w-full rounded-2xl border border-white/8 bg-aura-panelSoft p-3 text-left transition hover:border-aura-accent/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{job.title}</p>
                        <p className="mt-1 text-xs text-aura-muted">{job.status} · {job.progress}%</p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-aura-muted" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-[70vh] flex-1 flex-col rounded-[32px] border border-aura-line bg-white/5 shadow-aura backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-aura-accent/10 p-2 text-aura-accent">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-xl">Console Aura</p>
                <p className="text-sm text-aura-muted">Camadas Client → API → Core → System</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-aura-muted sm:flex">
              <TerminalSquare className="h-3.5 w-3.5" />
              localhost premium local-first
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
            {selectedJob ? (
              <section className="max-w-3xl rounded-[28px] border border-white/8 bg-aura-panelSoft p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-aura-muted">Agent Mode</p>
                    <h2 className="mt-2 font-display text-2xl">{selectedJob.title}</h2>
                    <p className="mt-2 text-sm text-aura-muted">{selectedJob.goal}</p>
                    <p className="mt-2 text-sm text-aura-muted">
                      Status: {selectedJob.status} · Progresso: {selectedJob.progress}% · Steps: {selectedJob.steps.length}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleStartJob(selectedJob.id)}
                      className="rounded-2xl border border-aura-accent/40 bg-aura-accent/10 px-3 py-2 text-sm"
                    >
                      Iniciar
                    </button>
                    <button
                      onClick={() => void handleCancelJob(selectedJob.id)}
                      className="rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {selectedJob.steps.map((step) => (
                    <div key={`${selectedJob.id}-${step.order}`} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">{step.order + 1}. {step.title}</p>
                        <span className="text-xs text-aura-muted">{step.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-aura-muted">{step.description}</p>
                      {step.command ? <p className="mt-2 text-xs text-aura-muted">Comando: {step.command}</p> : null}
                      {step.error ? <p className="mt-2 text-xs text-red-200">{step.error}</p> : null}
                      {step.output ? <p className="mt-2 whitespace-pre-wrap text-xs text-aura-muted">{step.output}</p> : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`max-w-3xl rounded-[28px] border px-4 py-4 sm:px-5 ${
                  message.role === "assistant"
                    ? "border-white/8 bg-aura-panel"
                    : "ml-auto border-aura-accent/30 bg-aura-accent/10"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-aura-muted">
                  {message.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <Command className="h-3.5 w-3.5" />}
                  {message.role === "assistant" ? "Aura" : "Você"}
                </div>
                <p className="whitespace-pre-wrap text-[15px] leading-7 text-aura-text">{message.content}</p>
                {message.meta ? <p className="mt-3 text-xs text-aura-muted">{message.meta}</p> : null}
              </article>
            ))}
            {isPending ? (
              <div className="flex max-w-xl items-center gap-3 rounded-3xl border border-white/8 bg-aura-panel px-5 py-4 text-sm text-aura-muted">
                <LoaderCircle className="h-4 w-4 animate-spin text-aura-accent" />
                Aura está processando a solicitação localmente.
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/8 p-4 sm:p-6">
            {envWarnings.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {envWarnings.join(" ")}
              </div>
            ) : null}
            {error ? (
              <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}
            <div className="rounded-[28px] border border-white/10 bg-aura-panel p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1">
                  <span className="mb-2 block text-xs uppercase tracking-[0.24em] text-aura-muted">Mensagem</span>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    rows={3}
                    placeholder="Peça uma análise, consulte o status do sistema ou acione um projeto."
                    className="w-full resize-none rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-aura-text outline-none transition placeholder:text-aura-muted focus:border-aura-accent/70"
                  />
                </label>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={isPending}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#72e0a6,#68cde7)] px-5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Enviando..." : "Falar com a Aura"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

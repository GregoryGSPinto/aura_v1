import { ApiEnvelope, ChatPayload, ProjectsPayload, StatusPayload } from "@/lib/types";
import { clientEnv } from "@/lib/env";

async function request<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  if (!clientEnv.apiUrl) {
    throw new Error("A URL da API da Aura não foi configurada. Defina NEXT_PUBLIC_API_URL.");
  }

  const headers = new Headers(init?.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (clientEnv.auraToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${clientEnv.auraToken}`);
  }

  const response = await fetch(`${clientEnv.apiUrl}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const data = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !data.success) {
    throw new Error(data.error?.message ?? "Falha ao acessar a API da Aura.");
  }
  return data;
}

export async function fetchStatus() {
  return request<StatusPayload>("/status");
}

export async function fetchProjects() {
  return request<ProjectsPayload>("/projects");
}

export async function sendChat(message: string, history: Array<{ role: "user" | "assistant"; content: string }>) {
  return request<ChatPayload>("/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      context: {
        session_id: "local-web-session",
        history,
      },
      options: {
        stream: false,
        temperature: 0.2,
        think: false,
      },
    }),
  });
}

export async function openProject(name: string) {
  return request<{ name: string; path: string; opened_in: string; message: string }>("/projects/open", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

import type { PlanDocument } from "@just-plan/plan-schema";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Project = {
  id: string;
  name: string;
  thumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(rest.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  url: API_URL,
  me: (token: string) => request<{ user: { id: string; email: string } }>("/auth/me", { token }),
  listProjects: (token: string) => request<Project[]>("/projects", { token }),
  createProject: (token: string, name: string) =>
    request<Project>("/projects", {
      token,
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  getProject: (token: string, id: string) =>
    request<{ project: Project; plan: PlanDocument; revision: unknown }>(
      `/projects/${id}`,
      { token },
    ),
  undo: (token: string, id: string) =>
    request<{ plan: PlanDocument }>(`/projects/${id}/plan/undo`, {
      token,
      method: "POST",
      body: "{}",
    }),
  commitPlan: (token: string, id: string, plan: PlanDocument) =>
    request<{ plan: PlanDocument }>(`/projects/${id}/plan/commit`, {
      token,
      method: "POST",
      body: JSON.stringify({ plan, source: "manual" }),
    }),
  upload: async (token: string, projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ asset: { url: string }; job: { id: string; status: string } }>(
      `/files/projects/${projectId}/upload`,
      { token, method: "POST", body: form },
    );
  },
  getJob: (token: string, jobId: string) =>
    request<{ id: string; status: string; progress: number; error?: string }>(
      `/jobs/${jobId}`,
      { token },
    ),
  chatHistory: (token: string, projectId: string) =>
    request<Array<{ id: string; role: string; content: string }>>(
      `/projects/${projectId}/agent/messages`,
      { token },
    ),
  chat: (token: string, projectId: string, message: string) =>
    request<{ message: { content: string }; plan: PlanDocument }>(
      `/projects/${projectId}/agent/chat`,
      {
        token,
        method: "POST",
        body: JSON.stringify({ message }),
      },
    ),
};

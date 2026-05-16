import type { FormLead, SiteProject, SiteTemplate, User } from '../types/domain';
import { encryptEpe2 } from './epe2';

const KEYS = {
  session: 'csmv2_session',
  users: 'csmv2_users',
  projects: 'csmv2_projects',
  templates: 'csmv2_templates',
  leads: 'csmv2_leads',
};

function load<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export function getUsers(): User[] {
  const users = load<User[]>(KEYS.users, []);
  if (!users.some((u) => u.role === 'admin')) {
    const admin: User = {
      email: 'admin@csmv2.local',
      name: 'Administrador CSMV2',
      role: 'admin',
      password: 'Admin123!csmv2',
      createdAt: new Date().toISOString(),
    };
    const updated = [admin, ...users];
    save(KEYS.users, updated);
    return updated;
  }
  return users;
}

export function upsertUser(user: User): void {
  const users = getUsers();
  const next = users.filter((u) => u.email !== user.email).concat(user);
  save(KEYS.users, next);
}

export function getProjects(): SiteProject[] {
  return load<SiteProject[]>(KEYS.projects, []);
}

export function upsertProject(project: SiteProject): void {
  const next = getProjects().filter((p) => p.ownerEmail !== project.ownerEmail).concat(project);
  save(KEYS.projects, next);
}

export function getTemplates(): SiteTemplate[] {
  return load<SiteTemplate[]>(KEYS.templates, []);
}

export function upsertTemplate(template: SiteTemplate): void {
  const next = getTemplates().filter((t) => t.id !== template.id).concat(template);
  save(KEYS.templates, next);
}

export function getLeads(): FormLead[] {
  return load<FormLead[]>(KEYS.leads, []);
}

export function pushLead(lead: FormLead): void {
  save(KEYS.leads, [lead, ...getLeads()]);
}

export function setSession(email: string): void {
  localStorage.setItem(KEYS.session, email);
}

export function getSession(): string | null {
  return localStorage.getItem(KEYS.session);
}

export function clearSession(): void {
  localStorage.removeItem(KEYS.session);
}

export function issueUrl(command: string, payload: unknown): string {
  const owner = 'lerna-admin';
  const repo = 'CSMV2';
  const title = encodeURIComponent(`[CSMV2] ${command}`);
  const bodyPayload = JSON.stringify(payload, null, 2);
  const encrypted = encryptEpe2(bodyPayload, `${command}.json`);
  const body = encodeURIComponent(`command: ${command}\n\nEPE2 payload:\n\n${encrypted}`);
  return `https://github.com/${owner}/${repo}/issues/new?labels=automation,csm-command&title=${title}&body=${body}`;
}

import type { Agent, FormLead, PlatformSettings, SiteProject, SiteTemplate, SiteTheme, User } from '../types/domain';
import { decryptEpe2, encryptEpe2 } from './epe2';

const KEYS = {
  session: 'csmv2_session',
  users: 'csmv2_users',
  projects: 'csmv2_projects',
  templates: 'csmv2_templates',
  leads: 'csmv2_leads',
  agents: 'csmv2_agents',
  settings: 'csmv2_settings',
  queue: 'csmv2_command_queue',
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
  const users = load<Array<User & { password?: string }>>(KEYS.users, []);
  const canonicalAdmin: User = {
    email: 'admin@csmv2.local',
    name: 'Administrador CSMV2',
    role: 'admin',
    passwordEncrypted: encryptEpe2('Admin123!csmv2', 'admin@csmv2.local'),
    createdAt: new Date().toISOString(),
  };
  const migratedUsers: User[] = users
    .filter((u) => u.email.toLowerCase().trim() !== canonicalAdmin.email)
    .map((u) => {
      if (u.passwordEncrypted && String(u.passwordEncrypted).startsWith('EPE2:')) {
        return {
          email: String(u.email).trim().toLowerCase(),
          name: u.name,
          role: u.role,
          passwordEncrypted: u.passwordEncrypted,
          createdAt: u.createdAt,
        };
      }
      const plain = String(u.password || '').trim();
      return {
        email: String(u.email).trim().toLowerCase(),
        name: u.name,
        role: u.role,
        passwordEncrypted: encryptEpe2(plain, String(u.email).trim().toLowerCase()),
        createdAt: u.createdAt,
      };
    });
  const updated = [canonicalAdmin, ...migratedUsers];
  save(KEYS.users, updated);
  return updated;
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
  const next = getProjects().filter((p) => p.id !== project.id).concat(project);
  save(KEYS.projects, next);
}

export function getTemplates(): SiteTemplate[] {
  const saved = load<SiteTemplate[]>(KEYS.templates, []);
  const system = getSystemTemplates();
  const systemIds = new Set(system.map((tpl) => tpl.id));
  const merged = system.concat(saved.filter((tpl) => !systemIds.has(tpl.id) && tpl.ownerEmail !== 'system@csmv2.local'));
  if (JSON.stringify(saved.map((tpl) => tpl.id)) !== JSON.stringify(merged.map((tpl) => tpl.id))) save(KEYS.templates, merged);
  return merged;
}

function getSystemTemplates(): SiteTemplate[] {
  const now = '2026-05-16T00:00:00.000Z';
  const templateUrl = (slug: string) => `${import.meta.env.BASE_URL}templates/${slug}/index.html`;
  const makeHtmlTemplate = (
    id: string,
    name: string,
    slug: string,
    theme: SiteTheme,
    source: string,
  ): SiteTemplate => ({
    id,
    ownerEmail: 'system@csmv2.local',
    ownerRole: 'admin',
    name,
    createdAt: now,
    publicTemplate: true,
    theme,
    blocks: [
      {
        id: `${id}-page`,
        type: 'html',
        nodeType: 'section',
        pageId: 'home',
        pageName: 'Home',
        title: name,
        content: `Template exacto importado desde ${source} y servido localmente por CSMV2.`,
        embedUrl: templateUrl(slug),
        customClass: 'page raw-template-section',
        customCss: 'padding:0;border:0;background:transparent;box-shadow:none;',
      },
    ],
  });

  return [
    makeHtmlTemplate(
      'system-labspa-original',
      'LabSpa original HTML Design',
      'labspa',
      { name: 'LabSpa Original', primary: '#6400d4', accent: '#f74d40', background: '#ffffff', surface: '#ffffff', text: '#111111', font: 'Poppins, Rajdhani, sans-serif', radius: 0 },
      'ThemeWagon LabSpa',
    ),
    makeHtmlTemplate(
      'system-timezone-original',
      'TimeZone ecommerce original',
      'timezone',
      { name: 'TimeZone', primary: '#ff2020', accent: '#141517', background: '#ffffff', surface: '#ffffff', text: '#0b1c39', font: 'Josefin Sans, sans-serif', radius: 0 },
      'ThemeWagon TimeZone',
    ),
    makeHtmlTemplate(
      'system-executive-original',
      'Executive academic original',
      'executive',
      { name: 'Executive', primary: '#1b46f5', accent: '#ffb30e', background: '#ffffff', surface: '#ffffff', text: '#2f2f2f', font: 'Poppins, sans-serif', radius: 0 },
      'ThemeWagon Executive',
    ),
    makeHtmlTemplate(
      'system-space-dynamic-original',
      'SpaceDynamic marketing original',
      'space-dynamic',
      { name: 'SpaceDynamic', primary: '#03a4ed', accent: '#fe3f40', background: '#ffffff', surface: '#ffffff', text: '#2a2a2a', font: 'Poppins, sans-serif', radius: 0 },
      'ThemeWagon SpaceDynamic',
    ),
    makeHtmlTemplate(
      'system-collab-original',
      'Collab corporate original',
      'collab',
      { name: 'Collab', primary: '#3a86ff', accent: '#f857a6', background: '#ffffff', surface: '#ffffff', text: '#1f1534', font: 'Poppins, sans-serif', radius: 0 },
      'ThemeWagon Collab',
    ),
    makeHtmlTemplate(
      'system-foodwagon-original',
      'FoodwaGon restaurant original',
      'foodwagon',
      { name: 'FoodwaGon', primary: '#ffb30e', accent: '#f17228', background: '#ffffff', surface: '#ffffff', text: '#424242', font: 'Source Sans Pro, sans-serif', radius: 0 },
      'ThemeWagon FoodwaGon',
    ),
    makeHtmlTemplate(
      'system-watch-original',
      'Watch landing original',
      'watch-2',
      { name: 'Watch', primary: '#f8fbff', accent: '#f95c19', background: '#0b1628', surface: '#111827', text: '#ffffff', font: 'Poppins, sans-serif', radius: 0 },
      'ThemeWagon Watch',
    ),
  ];
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

export function getAgents(): Agent[] {
  return load<Agent[]>(KEYS.agents, []);
}

export function upsertAgent(agent: Agent): void {
  const next = getAgents().filter((a) => a.email !== agent.email).concat(agent);
  save(KEYS.agents, next);
}

export function getSettings(): PlatformSettings {
  return load<PlatformSettings>(KEYS.settings, {
    allowPublicSignup: true,
    defaultPublishTarget: 'production',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system',
  });
}

export function saveSettings(settings: PlatformSettings): void {
  save(KEYS.settings, settings);
}

export function enqueueCommand(command: string, payload: unknown): void {
  const item = {
    id: crypto.randomUUID(),
    command,
    payload: encryptEpe2(JSON.stringify(payload, null, 2), `${command}.json`),
    createdAt: new Date().toISOString(),
    status: 'queued',
  };
  const queue = load<typeof item[]>(KEYS.queue, []);
  save(KEYS.queue, [item, ...queue]);
  void createIssueByApi(command, item.payload);
}

async function createIssueByApi(command: string, encryptedPayload: string): Promise<void> {
  const sessionEmail = getSession();
  const rawToken = localStorage.getItem('csmv2_github_token_epe');
  const token = rawToken && sessionEmail ? decryptEpe2(rawToken, sessionEmail) : '';
  if (!token) return;
  await fetch('https://api.github.com/repos/lerna-admin/CSMV2/issues', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: `[CSMV2] ${command}`,
      labels: ['automation', 'csm-command'],
      body: `command: ${command}\n\nEPE2 payload:\n\n${encryptedPayload}`,
    }),
  }).catch(() => undefined);
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

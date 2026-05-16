import type { Agent, FormLead, PlatformSettings, SiteProject, SiteTemplate, User } from '../types/domain';
import { encryptEpe2 } from './epe2';

const KEYS = {
  session: 'csmv2_session',
  users: 'csmv2_users',
  projects: 'csmv2_projects',
  templates: 'csmv2_templates',
  leads: 'csmv2_leads',
  agents: 'csmv2_agents',
  settings: 'csmv2_settings',
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
  const next = getProjects().filter((p) => p.ownerEmail !== project.ownerEmail).concat(project);
  save(KEYS.projects, next);
}

export function getTemplates(): SiteTemplate[] {
  const saved = load<SiteTemplate[]>(KEYS.templates, []);
  if (saved.length) return saved;
  const now = new Date().toISOString();
  const starterBase: SiteTemplate[] = [
    {
      id: crypto.randomUUID(),
      ownerEmail: 'system@csmv2.local',
      ownerRole: 'admin',
      name: 'SaaS Launch (inspirada en landing gratuita)',
      createdAt: now,
      publicTemplate: true,
      blocks: [
        { id: crypto.randomUUID(), type: 'section', nodeType: 'section', pageId: 'home', pageName: 'Home', title: 'Hero Page', content: 'Lanzamiento de producto' },
        { id: crypto.randomUUID(), type: 'hero', nodeType: 'element', parentId: '', pageId: 'home', pageName: 'Home', title: 'Escala tu negocio', content: 'Automatiza procesos en minutos', buttonText: 'Comenzar', buttonUrl: '#', customClass: 'hero-saas' },
        { id: crypto.randomUUID(), type: 'features', nodeType: 'element', parentId: '', pageId: 'home', pageName: 'Home', title: 'Ventajas', content: 'Todo en uno', items: ['Integraciones', 'Reportes', 'Seguridad'] },
      ],
    },
    {
      id: crypto.randomUUID(),
      ownerEmail: 'system@csmv2.local',
      ownerRole: 'admin',
      name: 'Portfolio Creative (inspirada en plantilla gratis)',
      createdAt: now,
      publicTemplate: true,
      blocks: [
        { id: crypto.randomUUID(), type: 'section', nodeType: 'section', pageId: 'home', pageName: 'Home', title: 'Portafolio', content: 'Muestra proyectos' },
        { id: crypto.randomUUID(), type: 'gallery', nodeType: 'element', parentId: '', pageId: 'home', pageName: 'Home', title: 'Trabajos', content: 'Colección', items: ['https://picsum.photos/560/320', 'https://picsum.photos/561/320'] },
        { id: crypto.randomUUID(), type: 'cta', nodeType: 'element', parentId: '', pageId: 'home', pageName: 'Home', title: 'Hablemos', content: 'Agenda una llamada', buttonText: 'Contactar', buttonUrl: '#' },
      ],
    },
    {
      id: crypto.randomUUID(),
      ownerEmail: 'system@csmv2.local',
      ownerRole: 'admin',
      name: 'Restaurant OnePage (inspirada en tema free)',
      createdAt: now,
      publicTemplate: true,
      blocks: [
        { id: crypto.randomUUID(), type: 'section', nodeType: 'section', pageId: 'home', pageName: 'Home', title: 'Restaurante', content: 'Sabor artesanal' },
        { id: crypto.randomUUID(), type: 'navbar', nodeType: 'element', parentId: '', pageId: 'home', pageName: 'Home', title: 'Menu', content: 'Inicio|Carta|Reservas', items: ['Inicio', 'Carta', 'Reservas'] },
        { id: crypto.randomUUID(), type: 'contactForm', nodeType: 'element', parentId: '', pageId: 'home', pageName: 'Home', title: 'Reservar mesa', content: 'Deja tus datos' },
      ],
    },
  ];
  const starter: SiteTemplate[] = starterBase.map((tpl) => {
    const sectionId = tpl.blocks.find((b) => b.type === 'section')?.id || '';
    return {
      ...tpl,
      blocks: tpl.blocks.map((b) => (b.nodeType === 'element' ? { ...b, parentId: sectionId } : b)),
    };
  });
  save(KEYS.templates, starter);
  return starter;
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

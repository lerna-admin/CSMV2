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
  const next = getProjects().filter((p) => p.ownerEmail !== project.ownerEmail).concat(project);
  save(KEYS.projects, next);
}

export function getTemplates(): SiteTemplate[] {
  const saved = load<SiteTemplate[]>(KEYS.templates, []);
  const system = getSystemTemplates();
  const merged = system.concat(saved.filter((tpl) => !system.some((base) => base.id === tpl.id)));
  if (JSON.stringify(saved.map((tpl) => tpl.id)) !== JSON.stringify(merged.map((tpl) => tpl.id))) save(KEYS.templates, merged);
  return merged;
}

function getSystemTemplates(): SiteTemplate[] {
  const now = '2026-05-16T00:00:00.000Z';
  const labSpaTheme: SiteTheme = {
    name: 'LabSpa Wellness',
    primary: '#243c5a',
    accent: '#f18f5f',
    background: '#fff7ef',
    surface: '#ffffff',
    text: '#27313f',
    font: 'Aptos, Segoe UI, sans-serif',
    radius: 18,
  };
  const clinicTheme: SiteTheme = {
    name: 'Therapy Calm',
    primary: '#006d77',
    accent: '#83c5be',
    background: '#edf6f9',
    surface: '#ffffff',
    text: '#1f2937',
    font: 'Aptos, Segoe UI, sans-serif',
    radius: 14,
  };
  const beautyTheme: SiteTheme = {
    name: 'Beauty Editorial',
    primary: '#5f365f',
    accent: '#d8a7b1',
    background: '#fff4f7',
    surface: '#ffffff',
    text: '#211827',
    font: 'Georgia, serif',
    radius: 10,
  };
  const retreatTheme: SiteTheme = {
    name: 'Retreat Natural',
    primary: '#31572c',
    accent: '#b5c99a',
    background: '#f6f4ea',
    surface: '#ffffff',
    text: '#263326',
    font: 'Aptos, Segoe UI, sans-serif',
    radius: 16,
  };

  const starterBase: SiteTemplate[] = [
    {
      id: 'system-labspa-wellness',
      ownerEmail: 'system@csmv2.local',
      ownerRole: 'admin',
      name: 'LabSpa Wellness Landing',
      createdAt: now,
      publicTemplate: true,
      theme: labSpaTheme,
      blocks: [
        { id: 'labspa-home', type: 'section', nodeType: 'section', pageId: 'home', pageName: 'Home', title: 'LabSpa', content: 'Experiencias de bienestar para descansar, renovar y volver a tu centro.', customClass: 'page labspa-hero', customCss: 'background:linear-gradient(135deg,#fff7ef,#f9ded0);padding:72px 48px;border-radius:26px;' },
        { id: 'labspa-nav', type: 'navbar', nodeType: 'element', parentId: 'labspa-home', pageId: 'home', pageName: 'Home', title: 'Menu', content: 'Inicio|Tratamientos|Reservas', items: ['Inicio', 'Tratamientos', 'Reservas'], customCss: 'background:#ffffffcc;padding:14px 18px;border-radius:999px;' },
        { id: 'labspa-hero', type: 'hero', nodeType: 'element', parentId: 'labspa-home', pageId: 'home', pageName: 'Home', title: 'Relajacion premium para cuerpo y mente', content: 'Diseña una experiencia spa moderna con reservas, servicios, testimonios y contacto en una sola landing editable.', buttonText: 'Reservar ahora', buttonUrl: '#', image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1400&q=80', customCss: 'padding:56px 32px;border-radius:22px;background:#ffffff;box-shadow:0 24px 70px #8b4b2d24;' },
        { id: 'labspa-services', type: 'features', nodeType: 'element', parentId: 'labspa-home', pageId: 'home', pageName: 'Home', title: 'Tratamientos destacados', content: 'Masajes terapeuticos, faciales, aromaterapia y paquetes para parejas.', items: ['Masaje relajante', 'Facial luminoso', 'Ritual aromatico', 'Spa para parejas'], customCss: 'padding:32px;background:#243c5a;color:#ffffff;border-radius:20px;' },
        { id: 'labspa-gallery', type: 'gallery', nodeType: 'element', parentId: 'labspa-home', pageId: 'home', pageName: 'Home', title: 'Ambiente', content: 'Espacios serenos, detalles calidos y experiencia cuidada.', items: ['https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=900&q=80'], customCss: 'padding:30px;background:#fffaf6;border-radius:18px;' },
        { id: 'labspa-contact', type: 'contactForm', nodeType: 'element', parentId: 'labspa-home', pageId: 'home', pageName: 'Home', title: 'Agenda tu visita', content: 'Recibe solicitudes desde la landing y gestionalas en el panel.', customCss: 'padding:34px;background:#f18f5f;color:#ffffff;border-radius:20px;' },
      ],
    },
    {
      id: 'system-physio-clinic',
      ownerEmail: 'system@csmv2.local',
      ownerRole: 'admin',
      name: 'Physio Clinic SPA',
      createdAt: now,
      publicTemplate: true,
      theme: clinicTheme,
      blocks: [
        { id: 'physio-home', type: 'section', nodeType: 'section', pageId: 'home', pageName: 'Home', title: 'Clinica de fisioterapia', content: 'Recuperacion, movilidad y seguimiento profesional.', customClass: 'page', customCss: 'background:#edf6f9;padding:64px 44px;border-radius:22px;' },
        { id: 'physio-hero', type: 'hero', nodeType: 'element', parentId: 'physio-home', pageId: 'home', pageName: 'Home', title: 'Vuelve a moverte con confianza', content: 'Landing para terapeutas, centros de rehabilitacion y servicios de masaje clinico.', buttonText: 'Evaluacion inicial', buttonUrl: '#', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=80', customCss: 'background:#ffffff;padding:48px;border-radius:20px;box-shadow:0 22px 60px #006d7720;' },
        { id: 'physio-features', type: 'features', nodeType: 'element', parentId: 'physio-home', pageId: 'home', pageName: 'Home', title: 'Programas', content: 'Servicios claros para convertir visitas en citas.', items: ['Rehabilitacion deportiva', 'Terapia manual', 'Dolor cronico', 'Post operatorio'], customCss: 'background:#006d77;color:#ffffff;padding:30px;border-radius:18px;' },
        { id: 'physio-faq', type: 'faq', nodeType: 'element', parentId: 'physio-home', pageId: 'home', pageName: 'Home', title: 'Preguntas frecuentes', content: 'Reduce friccion antes de la reserva.', items: ['Cuanto dura una sesion?:Entre 45 y 60 minutos', 'Necesito orden medica?:Depende del tratamiento', 'Atienden empresas?:Si, planes corporativos'], customCss: 'background:#ffffff;padding:28px;border-radius:18px;' },
      ],
    },
    {
      id: 'system-beauty-editorial',
      ownerEmail: 'system@csmv2.local',
      ownerRole: 'admin',
      name: 'Beauty Studio Editorial',
      createdAt: now,
      publicTemplate: true,
      theme: beautyTheme,
      blocks: [
        { id: 'beauty-home', type: 'section', nodeType: 'section', pageId: 'home', pageName: 'Home', title: 'Beauty Studio', content: 'Tratamientos esteticos con una presencia visual editorial.', customClass: 'page', customCss: 'background:#fff4f7;padding:70px 42px;border-radius:24px;' },
        { id: 'beauty-hero', type: 'hero', nodeType: 'element', parentId: 'beauty-home', pageId: 'home', pageName: 'Home', title: 'Piel, estilo y confianza', content: 'Plantilla para salones, esteticas, cosmetologia, manicura y marcas personales.', buttonText: 'Ver servicios', buttonUrl: '#', image: 'https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&w=1400&q=80', customCss: 'background:#ffffff;padding:52px 36px;border-radius:22px;border:1px solid #f3c6cf;' },
        { id: 'beauty-gallery', type: 'gallery', nodeType: 'element', parentId: 'beauty-home', pageId: 'home', pageName: 'Home', title: 'Resultados', content: 'Muestra trabajos y experiencias.', items: ['https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80', 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=900&q=80'], customCss: 'background:#ffffff;padding:28px;border-radius:18px;' },
        { id: 'beauty-cta', type: 'cta', nodeType: 'element', parentId: 'beauty-home', pageId: 'home', pageName: 'Home', title: 'Agenda una consulta', content: 'Convierte interes en reservas.', buttonText: 'Reservar', buttonUrl: '#', customCss: 'background:#5f365f;color:#ffffff;padding:34px;border-radius:20px;' },
      ],
    },
    {
      id: 'system-retreat-spa',
      ownerEmail: 'system@csmv2.local',
      ownerRole: 'admin',
      name: 'Retreat Natural Multi Page',
      createdAt: now,
      publicTemplate: true,
      theme: retreatTheme,
      blocks: [
        { id: 'retreat-home', type: 'section', nodeType: 'section', pageId: 'home', pageName: 'Home', title: 'Retiro natural', content: 'Una SPA con paginas internas para experiencias, alojamiento y contacto.', customClass: 'page', customCss: 'background:#f6f4ea;padding:64px 42px;border-radius:24px;' },
        { id: 'retreat-hero', type: 'hero', nodeType: 'element', parentId: 'retreat-home', pageId: 'home', pageName: 'Home', title: 'Bienestar entre naturaleza', content: 'Para retiros, yoga, masajes holisticos y turismo wellness.', buttonText: 'Explorar retiro', buttonUrl: '#', image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1400&q=80', customCss: 'background:#ffffff;padding:50px;border-radius:20px;' },
        { id: 'retreat-programs', type: 'section', nodeType: 'section', pageId: 'programas', pageName: 'Programas', title: 'Programas', content: 'Pagina interna de programas.', customClass: 'page', customCss: 'background:#fffdf4;padding:60px 42px;border-radius:24px;' },
        { id: 'retreat-features', type: 'features', nodeType: 'element', parentId: 'retreat-programs', pageId: 'programas', pageName: 'Programas', title: 'Experiencias', content: 'Paquetes editables para vender experiencias.', items: ['Yoga al amanecer', 'Terapia corporal', 'Alimentacion consciente', 'Caminatas guiadas'], customCss: 'background:#31572c;color:#ffffff;padding:34px;border-radius:20px;' },
        { id: 'retreat-contact-page', type: 'section', nodeType: 'section', pageId: 'contacto', pageName: 'Contacto', title: 'Contacto', content: 'Pagina para capturar reservas.', customClass: 'page', customCss: 'background:#eef4df;padding:60px 42px;border-radius:24px;' },
        { id: 'retreat-form', type: 'contactForm', nodeType: 'element', parentId: 'retreat-contact-page', pageId: 'contacto', pageName: 'Contacto', title: 'Reserva tu cupo', content: 'Formulario listo para leads.', customCss: 'background:#ffffff;padding:34px;border-radius:20px;' },
      ],
    },
  ];
  return starterBase;
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

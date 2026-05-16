import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Builder from '../components/Builder';
import SiteRenderer from '../components/SiteRenderer';
import { currentUser } from '../lib/auth';
import { encryptEpe2, decryptEpe2 } from '../lib/epe2';
import { cloneBlocksWithNewIds, materializeTemplateBlocks } from '../lib/htmlTemplates';
import { clearSession, enqueueCommand, getAgents, getLeads, getProjects, getSettings, getTemplates, getUsers, saveSettings, upsertAgent, upsertProject, upsertTemplate } from '../lib/storage';
import type { SeoConfig, SiteBlock, SiteProject, SiteTemplate, SiteTheme } from '../types/domain';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = ['#1e40af', '#16a34a', '#ea580c'];
const baseSeo: SeoConfig = { title: 'CSMV2 Site', description: 'Sitio creado con CSMV2', keywords: ['csmv2'] };
const baseTheme: SiteTheme = {
  name: 'Studio Clean',
  primary: '#006edc',
  accent: '#d94f30',
  background: '#f7f1e8',
  surface: '#ffffff',
  text: '#141414',
  font: 'Aptos, Segoe UI, sans-serif',
  radius: 8,
};

const themePresets: SiteTheme[] = [
  baseTheme,
  { name: 'Editorial Pro', primary: '#1f2937', accent: '#b6862c', background: '#f8f1e7', surface: '#fffaf3', text: '#1f2937', font: 'Georgia, serif', radius: 4 },
  { name: 'SaaS Sharp', primary: '#075985', accent: '#16a34a', background: '#eef6ff', surface: '#ffffff', text: '#0f172a', font: 'Aptos, Segoe UI, sans-serif', radius: 14 },
  { name: 'Creative Dark', primary: '#ffffff', accent: '#f97316', background: '#111827', surface: '#1f2937', text: '#f9fafb', font: 'Trebuchet MS, sans-serif', radius: 12 },
];

export default function AppShell() {
  const user = currentUser();
  const [, setRefresh] = useState(0);
  const [history, setHistory] = useState<SiteProject[]>([]);
  const [future, setFuture] = useState<SiteProject[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateBlocks, setTemplateBlocks] = useState<SiteBlock[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState('');
  const [previewTemplateId, setPreviewTemplateId] = useState<string>('');
  const [newSiteTitle, setNewSiteTitle] = useState('');
  const [newSiteSlug, setNewSiteSlug] = useState('');
  const [templateLoadingId, setTemplateLoadingId] = useState('');
  const [automationToken, setAutomationToken] = useState(() => '');
  const routeLocation = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const storedAutomationToken = localStorage.getItem('csmv2_github_token_epe');
    if (!storedAutomationToken || !user?.email) return;
    try { setAutomationToken(decryptEpe2(storedAutomationToken, user.email)); } catch { /* Ignore invalid local token. */ }
  }, [user?.email]);

  if (!user) return <Navigate to="/" replace />;
  const actor = user;

  const allProjects = getProjects();
  const myProject = allProjects.find((p) => p.ownerEmail === actor.email) || null;
  const templates = getTemplates().filter((t) => t.publicTemplate || t.ownerEmail === actor.email);
  const myTemplates = templates.filter((t) => t.ownerEmail === actor.email);
  const leads = getLeads();
  const settings = getSettings();
  const agents = getAgents();
  const selectedTemplate = templates.find((t) => t.id === previewTemplateId) || null;

  const users = getUsers();
  const roleStats = ['admin', 'agente', 'usuario'].map((role) => ({ role, value: users.filter((u) => u.role === role).length }));
  const leadsBySite = (() => {
    const map = new Map<string, number>();
    for (const lead of leads) map.set(lead.siteSlug, (map.get(lead.siteSlug) || 0) + 1);
    return Array.from(map.entries()).map(([name, v]) => ({ name, v }));
  })();

  function slugify(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || actor.email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  function createSite() {
    const title = newSiteTitle.trim() || `${actor.name} Site`;
    const baseSlug = slugify(newSiteSlug || title);
    const usedSlugs = new Set(allProjects.filter((p) => p.ownerEmail !== actor.email).map((p) => p.slug));
    let slug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    const next: SiteProject = {
      id: crypto.randomUUID(),
      ownerEmail: actor.email,
      slug,
      title,
      description: 'Sitio creado con CSMV2',
      status: 'draft',
      updatedAt: new Date().toISOString(),
      blocks: [],
      seo: baseSeo,
      theme: baseTheme,
      versions: [],
      publishTarget: 'production',
    };
    upsertProject(next);
    enqueueCommand('create-project', { project: next, actor: actor.email });
    setNewSiteTitle('');
    setNewSiteSlug('');
    setRefresh((v) => v + 1);
  }

  const project = myProject;
  const projectTheme = project?.theme || baseTheme;

  function persist(next: SiteProject) {
    if (!project) return;
    setHistory((h) => [...h, project]);
    setFuture([]);
    upsertProject(next);
    setRefresh((v) => v + 1);
  }

  function publishSite() {
    if (!project) return;
    const command = project.publishTarget === 'staging' ? 'publish-site-staging' : 'publish-site-production';
    const nextProject: SiteProject = { ...project, status: 'published', updatedAt: new Date().toISOString() };
    upsertProject(nextProject);
    enqueueCommand(command, { project: nextProject, actor: actor.email });
    setRefresh((v) => v + 1);
    navigate(`/s/${nextProject.slug}`);
  }

  async function applyTemplate(template: SiteTemplate) {
    if (!project) return;
    setTemplateLoadingId(template.id);
    try {
      const blocks = template.blocks.some((block) => block.type === 'html')
        ? await materializeTemplateBlocks(template.blocks)
        : cloneBlocksWithNewIds(template.blocks);
      persist({ ...project, blocks, theme: template.theme || project.theme, templateId: template.id, updatedAt: new Date().toISOString() });
      setPreviewTemplateId('');
    } finally {
      setTemplateLoadingId('');
    }
  }

  function saveSharedTemplate() {
    if (!templateName.trim()) return;
    const template = {
      id: editingTemplateId || crypto.randomUUID(),
      ownerEmail: actor.email,
      ownerRole: actor.role,
      name: templateName.trim(),
      createdAt: new Date().toISOString(),
      blocks: templateBlocks,
      theme: baseTheme,
      publicTemplate: true,
    } as const;
    upsertTemplate(template);
    enqueueCommand('save-template', { template, actor: actor.email });
    setEditingTemplateId('');
    setTemplateName('');
    setTemplateBlocks([]);
    navigate('/app/site');
    setRefresh((v) => v + 1);
  }

  return (
    <main className="app-shell pro-shell">
      <header className="topbar">
        <div>
          <h1>CSMV2 Studio</h1>
          <p>{actor.name} · rol: {actor.role}</p>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={() => { clearSession(); window.location.href = '/CSMV2/'; }}>Cerrar sesion</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="studio-nav wpwix-nav">
          <h3>Panel</h3>
          <button type="button" className={routeLocation.pathname === '/app/site' ? 'active' : ''} onClick={() => navigate('/app/site')}>Sitio</button>
          <button type="button" className={routeLocation.pathname === '/app/templates' ? 'active' : ''} onClick={() => navigate('/app/templates')}>Crear plantilla</button>
          <button type="button" className={routeLocation.pathname === '/app/admin' ? 'active' : ''} onClick={() => navigate('/app/admin')}>Administracion</button>
        </aside>

        <div className="studio-content wpwix-content">
          {routeLocation.pathname === '/app/site' && (!project ? (
            <section className="create-site-panel">
              <div>
                <p className="eyebrow">Nuevo sitio</p>
                <h2>Crea una ruta publica antes de editar</h2>
                <p>El sitio empieza como borrador. Al publicar, quedara disponible en una ruta publica propia como #/s/mi-landing y se encolara el pipeline para guardar el JSON en el repositorio.</p>
              </div>
              <div className="create-site-form">
                <label>Nombre del sitio<input value={newSiteTitle} onChange={(event) => {
                  setNewSiteTitle(event.target.value);
                  if (!newSiteSlug) setNewSiteSlug(slugify(event.target.value));
                }} placeholder="Mi landing principal" /></label>
                <label>Ruta publica<input value={newSiteSlug} onChange={(event) => setNewSiteSlug(slugify(event.target.value))} placeholder="mi-landing" /></label>
                <button type="button" onClick={createSite}>Crear sitio</button>
              </div>
            </section>
          ) : (
            <>
              <section className="seo-panel">
                <h3>Sitio: {project.title}</h3>
                <p>Estado: {project.status === 'published' ? 'publicado' : 'borrador'} · URL publica: https://lerna-admin.github.io/CSMV2/#/s/{project.slug}</p>
                <div className="actions">
                  <button type="button" onClick={publishSite}>Publicar sitio</button>
                  <button type="button" disabled={!history.length} onClick={() => {
                    const prev = history[history.length - 1];
                    setHistory((h) => h.slice(0, -1));
                    setFuture((f) => [project, ...f]);
                    upsertProject(prev);
                    setRefresh((v) => v + 1);
                  }}>Undo</button>
                  <button type="button" disabled={!future.length} onClick={() => {
                    const [next, ...rest] = future;
                    if (!next) return;
                    setFuture(rest);
                    setHistory((h) => [...h, project]);
                    upsertProject(next);
                    setRefresh((v) => v + 1);
                  }}>Redo</button>
                </div>
                <div className="seo-grid">
                  <input value={project.seo.title} onChange={(e) => persist({ ...project, seo: { ...project.seo, title: e.target.value }, updatedAt: new Date().toISOString() })} placeholder="SEO title" />
                  <input value={project.seo.description} onChange={(e) => persist({ ...project, seo: { ...project.seo, description: e.target.value }, updatedAt: new Date().toISOString() })} placeholder="SEO description" />
                  <input value={project.seo.keywords.join(',')} onChange={(e) => persist({ ...project, seo: { ...project.seo, keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) }, updatedAt: new Date().toISOString() })} placeholder="keywords" />
                  <select value={project.publishTarget} onChange={(e) => persist({ ...project, publishTarget: e.target.value as 'staging' | 'production' })}>
                    <option value="staging">staging</option>
                    <option value="production">production</option>
                  </select>
                </div>
              </section>

              <section className="theme-panel">
                <div>
                  <h3>Tema global</h3>
                  <p>{projectTheme.name}</p>
                </div>
                <div className="theme-presets">
                  {themePresets.map((theme) => (
                    <button key={theme.name} type="button" onClick={() => persist({ ...project, theme, updatedAt: new Date().toISOString() })}>
                      <span style={{ background: theme.primary }} />
                      <span style={{ background: theme.accent }} />
                      {theme.name}
                    </button>
                  ))}
                </div>
                <div className="theme-grid">
                  <label>Primario<input type="color" value={projectTheme.primary} onChange={(e) => persist({ ...project, theme: { ...projectTheme, primary: e.target.value }, updatedAt: new Date().toISOString() })} /></label>
                  <label>Acento<input type="color" value={projectTheme.accent} onChange={(e) => persist({ ...project, theme: { ...projectTheme, accent: e.target.value }, updatedAt: new Date().toISOString() })} /></label>
                  <label>Fondo<input type="color" value={projectTheme.background} onChange={(e) => persist({ ...project, theme: { ...projectTheme, background: e.target.value }, updatedAt: new Date().toISOString() })} /></label>
                  <label>Texto<input type="color" value={projectTheme.text} onChange={(e) => persist({ ...project, theme: { ...projectTheme, text: e.target.value }, updatedAt: new Date().toISOString() })} /></label>
                </div>
              </section>

              <Builder blocks={project.blocks} theme={projectTheme} onChange={(blocks) => persist({ ...project, blocks, updatedAt: new Date().toISOString() })} />

              <section className="templates">
                <h3>Plantillas disponibles (compartidas)</h3>
                <div className="template-list">
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="template-card">
                      <strong>{tpl.name}</strong>
                      <button type="button" disabled={templateLoadingId === tpl.id} onClick={() => { void applyTemplate(tpl); }}>{templateLoadingId === tpl.id ? 'Preparando...' : 'Usar y editar'}</button>
                      <button type="button" onClick={() => setPreviewTemplateId(tpl.id)}>Visualizar</button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ))}

          {routeLocation.pathname === '/app/templates' && (
            <section className="template-studio">
              <h3>Crear plantilla</h3>
              <p>Vista independiente para construir plantillas sin ruido de administración.</p>
              {myTemplates.length > 0 && (
                <div className="template-list owned-template-list">
                  {myTemplates.map((tpl) => (
                    <div key={tpl.id} className="template-card">
                      <strong>{tpl.name}</strong>
                      <button type="button" onClick={() => {
                        setEditingTemplateId(tpl.id);
                        setTemplateName(tpl.name);
                        setTemplateBlocks(cloneBlocksWithNewIds(tpl.blocks));
                      }}>Editar plantilla</button>
                      <button type="button" onClick={() => setPreviewTemplateId(tpl.id)}>Visualizar</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="template-head">
                <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Nombre de plantilla" />
                <button type="button" onClick={saveSharedTemplate}>{editingTemplateId ? 'Actualizar plantilla' : 'Guardar plantilla compartida'}</button>
              </div>
              <div className="template-studio-grid">
                <Builder blocks={templateBlocks} theme={baseTheme} onChange={setTemplateBlocks} />
                <div className="template-preview live-preview">
                  <SiteRenderer blocks={templateBlocks} theme={baseTheme} />
                </div>
              </div>
            </section>
          )}

          {routeLocation.pathname === '/app/admin' && (
            actor.role === 'admin' ? (
              <section className="admin-panel">
                <h2>Panel de administracion</h2>
                <div className="charts-grid">
                  <article><h3>Roles</h3><ResponsiveContainer width="100%" height={220}><PieChart><Pie data={roleStats} dataKey="value" nameKey="role" outerRadius={80}>{roleStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></article>
                  <article><h3>Proyectos</h3><ResponsiveContainer width="100%" height={220}><BarChart data={[{ name: 'Draft', v: allProjects.filter((p) => p.status === 'draft').length }, { name: 'Published', v: allProjects.filter((p) => p.status === 'published').length }]}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="v" fill="#1e40af" /></BarChart></ResponsiveContainer></article>
                  <article><h3>Leads</h3><ResponsiveContainer width="100%" height={220}><BarChart data={leadsBySite}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="v" fill="#16a34a" /></BarChart></ResponsiveContainer></article>
                  <article><h3>Agentes</h3><p>{agents.length} activos</p><button type="button" onClick={() => {
                    const email = prompt('Email del agente');
                    const name = prompt('Nombre del agente');
                    if (!email || !name) return;
                    const agent = { id: crypto.randomUUID(), email: email.trim().toLowerCase(), name: name.trim(), role: 'agente' as const, createdAt: new Date().toISOString(), createdBy: actor.email };
                    upsertAgent(agent);
                    enqueueCommand('create-agent', { agent, actor: actor.email });
                    setRefresh((v) => v + 1);
                  }}>Crear agente</button></article>
                </div>
                <label>
                  <input type="checkbox" checked={settings.allowPublicSignup} onChange={(e) => {
                    const next = { ...settings, allowPublicSignup: e.target.checked, updatedAt: new Date().toISOString(), updatedBy: actor.email };
                    saveSettings(next);
                    enqueueCommand('save-settings', { settings: next, actor: actor.email });
                    setRefresh((v) => v + 1);
                  }} /> Permitir registro publico
                </label>
                <div className="automation-box">
                  <h3>Automatizacion GitHub</h3>
                  <input
                    type="password"
                    value={automationToken}
                    onChange={(event) => setAutomationToken(event.target.value)}
                    placeholder="Token fine-grained con permiso Issues"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem('csmv2_github_token_epe', encryptEpe2(automationToken.trim(), actor.email));
                      setRefresh((v) => v + 1);
                    }}
                  >
                    Guardar token local
                  </button>
                </div>
              </section>
            ) : <section className="admin-panel"><h3>Acceso restringido</h3><p>Solo administradores.</p></section>
          )}
        </div>
      </section>
      {selectedTemplate && (
        <div className="preview-modal" role="dialog" aria-modal="true">
          <div className="preview-modal-head">
            <div>
              <strong>{selectedTemplate.name}</strong>
              <span>Vista previa exacta. Cierra esta vista y pulsa “Usar y editar” para convertirla en tu sitio editable.</span>
            </div>
            <button type="button" onClick={() => setPreviewTemplateId('')}>Cerrar</button>
          </div>
          <div className="preview-modal-body">
            <SiteRenderer blocks={selectedTemplate.blocks} theme={selectedTemplate.theme || baseTheme} />
          </div>
        </div>
      )}
    </main>
  );
}

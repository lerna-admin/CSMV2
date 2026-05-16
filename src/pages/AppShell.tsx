import { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Builder from '../components/Builder';
import { currentUser } from '../lib/auth';
import { clearSession, getAgents, getLeads, getProjects, getSettings, getTemplates, getUsers, issueUrl, saveSettings, upsertAgent, upsertProject, upsertTemplate } from '../lib/storage';
import type { SeoConfig, SiteBlock, SiteProject } from '../types/domain';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = ['#1e40af', '#16a34a', '#ea580c'];
const baseSeo: SeoConfig = { title: 'CSMV2 Site', description: 'Sitio creado con CSMV2', keywords: ['csmv2'] };

function TemplatePreview({ blocks }: { blocks: SiteBlock[] }) {
  return (
    <div className="template-preview">
      {blocks.length === 0 && <p>Sin bloques aun.</p>}
      {blocks.map((block) => (
        <article key={block.id} className={`preview-block b-${block.type}`}>
          <h4>{block.title}</h4>
          <p>{block.content}</p>
        </article>
      ))}
    </div>
  );
}

export default function AppShell() {
  const user = currentUser();
  const [refresh, setRefresh] = useState(0);
  const [history, setHistory] = useState<SiteProject[]>([]);
  const [future, setFuture] = useState<SiteProject[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateBlocks, setTemplateBlocks] = useState<SiteBlock[]>([]);
  const [previewTemplateId, setPreviewTemplateId] = useState<string>('');
  const routeLocation = useLocation();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/" replace />;
  const actor = user;

  const allProjects = getProjects();
  const myProject = allProjects.find((p) => p.ownerEmail === actor.email) || null;
  const templates = getTemplates().filter((t) => t.publicTemplate || t.ownerEmail === actor.email);
  const leads = getLeads();
  const settings = getSettings();
  const agents = getAgents();
  const selectedTemplate = templates.find((t) => t.id === previewTemplateId) || null;

  const roleStats = useMemo(() => {
    const users = getUsers();
    return ['admin', 'agente', 'usuario'].map((role) => ({ role, value: users.filter((u) => u.role === role).length }));
  }, [refresh]);

  const leadsBySite = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of leads) map.set(lead.siteSlug, (map.get(lead.siteSlug) || 0) + 1);
    return Array.from(map.entries()).map(([name, v]) => ({ name, v }));
  }, [refresh]);

  function ensureProject() {
    if (myProject) return myProject;
    const next: SiteProject = {
      id: crypto.randomUUID(),
      ownerEmail: actor.email,
      slug: actor.email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      title: `${actor.name} Site`,
      description: 'Proyecto inicial',
      status: 'draft',
      updatedAt: new Date().toISOString(),
      blocks: [],
      seo: baseSeo,
      versions: [],
      publishTarget: 'production',
    };
    upsertProject(next);
    window.open(issueUrl('create-project', { project: next, actor: actor.email }), '_blank', 'noopener,noreferrer');
    return next;
  }

  const project = ensureProject();

  function persist(next: SiteProject) {
    setHistory((h) => [...h, project]);
    setFuture([]);
    upsertProject(next);
    setRefresh((v) => v + 1);
  }

  function publishSite() {
    const command = project.publishTarget === 'staging' ? 'publish-site-staging' : 'publish-site-production';
    window.open(issueUrl(command, { project, actor: actor.email }), '_blank', 'noopener,noreferrer');
    upsertProject({ ...project, status: 'published', updatedAt: new Date().toISOString() });
    setRefresh((v) => v + 1);
  }

  function saveSharedTemplate() {
    if (!templateName.trim()) return;
    const template = {
      id: crypto.randomUUID(),
      ownerEmail: actor.email,
      ownerRole: actor.role,
      name: templateName.trim(),
      createdAt: new Date().toISOString(),
      blocks: templateBlocks,
      publicTemplate: true,
    } as const;
    upsertTemplate(template);
    window.open(issueUrl('save-template', { template, actor: actor.email }), '_blank', 'noopener,noreferrer');
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
          {routeLocation.pathname === '/app/site' && (
            <>
              <section className="seo-panel">
                <h3>Proyecto unico: {project.title}</h3>
                <p>URL publica: https://lerna-admin.github.io/CSMV2/#/s/{project.slug}</p>
                <div className="actions">
                  <button type="button" onClick={publishSite}>Publicar</button>
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

              <Builder blocks={project.blocks} onChange={(blocks) => persist({ ...project, blocks, updatedAt: new Date().toISOString() })} />

              <section className="templates">
                <h3>Plantillas disponibles (compartidas)</h3>
                <div className="template-list">
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="template-card">
                      <strong>{tpl.name}</strong>
                      <button type="button" onClick={() => persist({ ...project, blocks: tpl.blocks, templateId: tpl.id, updatedAt: new Date().toISOString() })}>Usar</button>
                      <button type="button" onClick={() => setPreviewTemplateId(tpl.id)}>Visualizar</button>
                    </div>
                  ))}
                </div>
                {selectedTemplate && <TemplatePreview blocks={selectedTemplate.blocks} />}
              </section>
            </>
          )}

          {routeLocation.pathname === '/app/templates' && (
            <section className="template-studio">
              <h3>Crear plantilla</h3>
              <p>Vista independiente para construir plantillas sin ruido de administración.</p>
              <div className="template-head">
                <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Nombre de plantilla" />
                <button type="button" onClick={saveSharedTemplate}>Guardar plantilla compartida</button>
              </div>
              <div className="template-studio-grid">
                <Builder blocks={templateBlocks} onChange={setTemplateBlocks} />
                <TemplatePreview blocks={templateBlocks} />
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
                    window.open(issueUrl('create-agent', { agent, actor: actor.email }), '_blank', 'noopener,noreferrer');
                    setRefresh((v) => v + 1);
                  }}>Crear agente</button></article>
                </div>
                <label>
                  <input type="checkbox" checked={settings.allowPublicSignup} onChange={(e) => {
                    const next = { ...settings, allowPublicSignup: e.target.checked, updatedAt: new Date().toISOString(), updatedBy: actor.email };
                    saveSettings(next);
                    window.open(issueUrl('save-settings', { settings: next, actor: actor.email }), '_blank', 'noopener,noreferrer');
                    setRefresh((v) => v + 1);
                  }} /> Permitir registro publico
                </label>
              </section>
            ) : <section className="admin-panel"><h3>Acceso restringido</h3><p>Solo administradores.</p></section>
          )}
        </div>
      </section>
    </main>
  );
}

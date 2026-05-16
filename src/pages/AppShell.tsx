import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Builder from '../components/Builder';
import { currentUser } from '../lib/auth';
import { clearSession, getLeads, getProjects, getTemplates, getUsers, issueUrl, upsertProject, upsertTemplate } from '../lib/storage';
import type { SeoConfig, SiteProject } from '../types/domain';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = ['#0077ff', '#22c55e', '#f97316'];
const baseSeo: SeoConfig = { title: 'CSMV2 Site', description: 'Sitio creado con CSMV2', keywords: ['csmv2'] };

export default function AppShell() {
  const user = currentUser();
  const [refresh, setRefresh] = useState(0);
  const [history, setHistory] = useState<SiteProject[]>([]);
  const [future, setFuture] = useState<SiteProject[]>([]);

  if (!user) return <Navigate to="/" replace />;
  const actor = user;

  const allProjects = getProjects();
  const myProject = allProjects.find((p) => p.ownerEmail === actor.email) || null;
  const templates = getTemplates().filter((t) => t.ownerEmail === actor.email || t.publicTemplate);
  const leads = getLeads();

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
    return next;
  }

  const project = ensureProject();

  function persist(next: SiteProject) {
    setHistory((h) => [...h, project]);
    setFuture([]);
    upsertProject(next);
    setRefresh((v) => v + 1);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>CSMV2 Studio</h1>
          <p>{actor.name} · rol: {actor.role}</p>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={() => { clearSession(); location.href = '/'; }}>Cerrar sesion</button>
        </div>
      </header>

      {actor.role === 'admin' && (
        <section className="admin-panel">
          <h2>Panel de administracion</h2>
          <div className="charts-grid">
            <article>
              <h3>Distribucion por roles</h3>
              <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={roleStats} dataKey="value" nameKey="role" outerRadius={80}>{roleStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
            </article>
            <article>
              <h3>Proyectos por estado</h3>
              <ResponsiveContainer width="100%" height={220}><BarChart data={[{ name: 'Draft', v: allProjects.filter((p) => p.status === 'draft').length }, { name: 'Published', v: allProjects.filter((p) => p.status === 'published').length }]}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="v" fill="#0077ff" /></BarChart></ResponsiveContainer>
            </article>
            <article>
              <h3>Leads por sitio</h3>
              <ResponsiveContainer width="100%" height={220}><BarChart data={leadsBySite}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="v" fill="#22c55e" /></BarChart></ResponsiveContainer>
            </article>
          </div>
        </section>
      )}

      <section className="workspace">
        <div className="workspace-head">
          <h2>Proyecto unico: {project.title}</h2>
          <p>URL publica: https://lerna-admin.github.io/CSMV2/#/s/{project.slug}</p>
          <div className="actions">
            <button type="button" onClick={() => {
              const command = project.publishTarget === 'staging' ? 'publish-site-staging' : 'publish-site-production';
              window.open(issueUrl(command, { project, actor: actor.email }), '_blank', 'noopener,noreferrer');
              upsertProject({ ...project, status: 'published', updatedAt: new Date().toISOString() });
              setRefresh((v) => v + 1);
            }}>Publicar</button>
            <button type="button" onClick={() => {
              const template = { id: crypto.randomUUID(), ownerEmail: actor.email, ownerRole: actor.role, name: `Template ${new Date().toLocaleDateString()}`, createdAt: new Date().toISOString(), blocks: project.blocks, publicTemplate: actor.role === 'admin' } as const;
              upsertTemplate(template);
              window.open(issueUrl('save-template', { template, actor: actor.email }), '_blank', 'noopener,noreferrer');
              setRefresh((v) => v + 1);
            }}>Guardar plantilla</button>
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
        </div>

        <section className="seo-panel">
          <h3>SEO</h3>
          <div className="seo-grid">
            <input value={project.seo.title} onChange={(e) => persist({ ...project, seo: { ...project.seo, title: e.target.value }, updatedAt: new Date().toISOString() })} placeholder="SEO title" />
            <input value={project.seo.description} onChange={(e) => persist({ ...project, seo: { ...project.seo, description: e.target.value }, updatedAt: new Date().toISOString() })} placeholder="SEO description" />
            <input value={project.seo.keywords.join(',')} onChange={(e) => persist({ ...project, seo: { ...project.seo, keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) }, updatedAt: new Date().toISOString() })} placeholder="keywords separadas por coma" />
            <select value={project.publishTarget} onChange={(e) => persist({ ...project, publishTarget: e.target.value as 'staging' | 'production' })}>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
          </div>
        </section>

        <Builder blocks={project.blocks} onChange={(blocks) => persist({ ...project, blocks, updatedAt: new Date().toISOString() })} />

        <section className="templates">
          <h3>Plantillas disponibles</h3>
          <div className="template-list">
            {templates.map((tpl) => <button key={tpl.id} type="button" onClick={() => persist({ ...project, blocks: tpl.blocks, templateId: tpl.id, updatedAt: new Date().toISOString() })}>{tpl.name}</button>)}
          </div>
        </section>

        <section className="versions">
          <h3>Versionado</h3>
          <div className="actions">
            <button type="button" onClick={() => {
              const version = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), label: `v${project.versions.length + 1}`, blocks: project.blocks, seo: project.seo };
              persist({ ...project, versions: [version, ...project.versions] });
              window.open(issueUrl('save-version', { siteSlug: project.slug, version, actor: actor.email }), '_blank', 'noopener,noreferrer');
            }}>Crear snapshot</button>
          </div>
          <div className="template-list">
            {project.versions.map((v) => <button key={v.id} type="button" onClick={() => persist({ ...project, blocks: v.blocks, seo: v.seo, updatedAt: new Date().toISOString() })}>{v.label} · {new Date(v.createdAt).toLocaleString()}</button>)}
          </div>
        </section>
      </section>
    </main>
  );
}

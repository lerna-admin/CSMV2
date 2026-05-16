import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Builder from '../components/Builder';
import { currentUser } from '../lib/auth';
import { clearSession } from '../lib/storage';
import { getProjects, getTemplates, getUsers, issueUrl, upsertProject, upsertTemplate } from '../lib/storage';
import type { SiteProject } from '../types/domain';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';

const COLORS = ['#0077ff', '#22c55e', '#f97316'];

export default function AppShell() {
  const user = currentUser();
  const [refresh, setRefresh] = useState(0);

  if (!user) return <Navigate to="/" replace />;
  const actor = user;

  const allProjects = getProjects();
  const myProject = allProjects.find((p) => p.ownerEmail === actor.email) || null;
  const templates = getTemplates().filter((t) => t.ownerEmail === actor.email || t.publicTemplate);

  const roleStats = useMemo(() => {
    const users = getUsers();
    return ['admin', 'agente', 'usuario'].map((role) => ({
      role,
      value: users.filter((u) => u.role === role).length,
    }));
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
    };
    upsertProject(next);
    setRefresh((v) => v + 1);
    return next;
  }

  const project = ensureProject();

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
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={roleStats} dataKey="value" nameKey="role" outerRadius={80}>
                    {roleStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </article>
            <article>
              <h3>Proyectos por estado</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[{ name: 'Draft', v: allProjects.filter((p) => p.status === 'draft').length }, { name: 'Published', v: allProjects.filter((p) => p.status === 'published').length }]}> 
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="v" fill="#0077ff" />
                </BarChart>
              </ResponsiveContainer>
            </article>
          </div>
        </section>
      )}

      <section className="workspace">
        <div className="workspace-head">
          <h2>Proyecto unico: {project.title}</h2>
          <p>URL publica: https://lerna-admin.github.io/CSMV2/#/s/{project.slug}</p>
          <div className="actions">
            <button
              type="button"
              onClick={() => {
                const issue = issueUrl('publish-site', { project, actor: actor.email });
                window.open(issue, '_blank', 'noopener,noreferrer');
                upsertProject({ ...project, status: 'published', updatedAt: new Date().toISOString() });
                setRefresh((v) => v + 1);
              }}
            >
              Publicar en GitHub Pages
            </button>
            <button
              type="button"
              onClick={() => {
                const template = {
                  id: crypto.randomUUID(),
                  ownerEmail: actor.email,
                  ownerRole: actor.role,
                  name: `Template ${new Date().toLocaleDateString()}`,
                  createdAt: new Date().toISOString(),
                  blocks: project.blocks,
                  publicTemplate: actor.role === 'admin',
                } as const;
                upsertTemplate(template);
                window.open(issueUrl('save-template', { template, actor: actor.email }), '_blank', 'noopener,noreferrer');
                setRefresh((v) => v + 1);
              }}
            >
              Guardar como plantilla
            </button>
          </div>
        </div>

        <Builder
          blocks={project.blocks}
          onChange={(blocks) => {
            upsertProject({ ...project, blocks, updatedAt: new Date().toISOString() });
            setRefresh((v) => v + 1);
          }}
        />

        <section className="templates">
          <h3>Plantillas disponibles</h3>
          <div className="template-list">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  upsertProject({ ...project, blocks: tpl.blocks, templateId: tpl.id, updatedAt: new Date().toISOString() });
                  setRefresh((v) => v + 1);
                }}
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

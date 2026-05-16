import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Builder from '../components/Builder';
import SiteRenderer from '../components/SiteRenderer';
import { currentUser } from '../lib/auth';
import { encryptEpe2, decryptEpe2 } from '../lib/epe2';
import { cloneBlocksWithNewIds, materializeTemplateBlocks } from '../lib/htmlTemplates';
import { cacheUploadedAsset, clearSession, enqueueCommand, getAgents, getLeads, getProjects, getSettings, getTemplates, getUsers, saveSettings, upsertAgent, upsertProject, upsertTemplate } from '../lib/storage';
import type { SiteBlock, SiteProject, SiteTemplate, SiteTheme } from '../types/domain';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = ['#1e40af', '#16a34a', '#ea580c'];
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
  const [activeProjectId, setActiveProjectId] = useState('');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [siteWizardStep, setSiteWizardStep] = useState(1);
  const [siteCreating, setSiteCreating] = useState(false);
  const [siteSlugTouched, setSiteSlugTouched] = useState(false);
  const [siteDraft, setSiteDraft] = useState({
    title: '',
    slug: '',
    description: '',
    seoTitle: '',
    seoDescription: '',
    keywords: '',
    ogImage: '',
    templateId: '',
    publishTarget: 'production' as 'staging' | 'production',
  });
  const [templateLoadingId, setTemplateLoadingId] = useState('');
  const [automationToken, setAutomationToken] = useState(() => '');
  const [revertingToPublished, setRevertingToPublished] = useState(false);
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
  const myProjects = allProjects
    .filter((p) => p.ownerEmail === actor.email)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const templates = getTemplates().filter((t) => t.publicTemplate || (actor.role === 'admin' && t.ownerEmail === actor.email));
  const myTemplates = actor.role === 'admin' ? templates.filter((t) => t.ownerEmail === actor.email) : [];
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

  function publicUrl(slug: string) {
    return `${window.location.origin}${import.meta.env.BASE_URL}#/s/${slug}`;
  }

  function editUrl(projectId: string) {
    return `${window.location.origin}${import.meta.env.BASE_URL}#/app/site?project=${projectId}`;
  }

  function siteAssetUrl(slug: string, fileName: string) {
    return `${window.location.origin}${import.meta.env.BASE_URL}data/sites/${slug}/assets/${fileName}`;
  }

  function sanitizeFileSegment(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(file);
    });
  }

  async function optimizeImage(file: File): Promise<{ dataUrl: string; extension: string }> {
    const source = await readFileAsDataUrl(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo procesar la imagen'));
      img.src = source;
    });
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / image.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl: source, extension: file.name.split('.').pop() || 'png' };
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const preferred = canvas.toDataURL('image/webp', 0.82);
    if (preferred.length < source.length) return { dataUrl: preferred, extension: 'webp' };
    return { dataUrl: source, extension: file.name.split('.').pop() || 'png' };
  }

  async function uploadSiteAsset(file: File, hint?: string): Promise<string> {
    if (!project) throw new Error('Selecciona un sitio antes de subir archivos');
    const optimized = await optimizeImage(file);
    if (optimized.dataUrl.length > 240000) throw new Error('La imagen sigue siendo demasiado grande para el flujo por issues. Usa una mas ligera.');
    const stamp = Date.now().toString(36);
    const fileName = `${sanitizeFileSegment(hint || file.name.replace(/\.[^.]+$/, ''))}-${stamp}.${optimized.extension}`;
    const publicAssetUrl = siteAssetUrl(project.slug, fileName);
    cacheUploadedAsset(publicAssetUrl, optimized.dataUrl);
    enqueueCommand('save-site-asset', {
      siteSlug: project.slug,
      fileName,
      dataUrl: optimized.dataUrl,
      actor: actor.email,
    });
    return publicAssetUrl;
  }

  async function loadPublishedSiteSnapshot(slug: string): Promise<SiteProject | null> {
    const indexResponse = await fetch(`${import.meta.env.BASE_URL}data/sites/index.json?ts=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
    if (!indexResponse?.ok) return null;
    const index = await indexResponse.json() as { files?: string[] };
    if (!index.files?.includes(`${slug}.json`)) return null;
    const response = await fetch(`${import.meta.env.BASE_URL}data/sites/${encodeURIComponent(slug)}.json?ts=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) return null;
    return await response.json() as SiteProject;
  }

  function updateSiteDraft(patch: Partial<typeof siteDraft>) {
    setSiteDraft((current) => ({ ...current, ...patch }));
  }

  function selectProject(id: string) {
    setActiveProjectId(id);
    localStorage.setItem(`csmv2_active_project_${actor.email}`, id);
    setHistory([]);
    setFuture([]);
    setShowCreateWizard(false);
    navigate(`/app/site?project=${id}`);
  }

  function resetSiteWizard() {
    setSiteSlugTouched(false);
    setSiteDraft({
      title: '',
      slug: '',
      description: '',
      seoTitle: '',
      seoDescription: '',
      keywords: '',
      ogImage: '',
      templateId: '',
      publishTarget: 'production',
    });
    setSiteWizardStep(1);
  }

  async function createSite() {
    if (!siteDraft.title.trim()) return;
    setSiteCreating(true);
    try {
      const title = siteDraft.title.trim();
      const description = siteDraft.description.trim() || 'Sitio creado con CSMV2';
      const baseSlug = slugify(siteDraft.slug || title);
      const usedSlugs = new Set(allProjects.map((p) => p.slug));
      let slug = baseSlug;
      let suffix = 2;
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${suffix}`;
        suffix += 1;
      }
      const selectedWizardTemplate = templates.find((template) => template.id === siteDraft.templateId) || null;
      const blocks = selectedWizardTemplate
        ? selectedWizardTemplate.blocks.some((block) => block.type === 'html')
          ? await materializeTemplateBlocks(selectedWizardTemplate.blocks)
          : cloneBlocksWithNewIds(selectedWizardTemplate.blocks)
        : [];
      const keywords = siteDraft.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean);
      const next: SiteProject = {
        id: crypto.randomUUID(),
        ownerEmail: actor.email,
        slug,
        title,
        description,
        status: 'draft',
        publishedAt: undefined,
        updatedAt: new Date().toISOString(),
        blocks,
        seo: {
          title: siteDraft.seoTitle.trim() || title,
          description: siteDraft.seoDescription.trim() || description,
          keywords: keywords.length ? keywords : [slug],
          ogImage: siteDraft.ogImage.trim() || undefined,
        },
        theme: selectedWizardTemplate?.theme || baseTheme,
        templateId: selectedWizardTemplate?.id,
        versions: [],
        publishTarget: siteDraft.publishTarget,
      };
      upsertProject(next);
      enqueueCommand('create-project', { project: next, actor: actor.email });
      selectProject(next.id);
      resetSiteWizard();
      setRefresh((v) => v + 1);
    } finally {
      setSiteCreating(false);
    }
  }

  const searchProjectId = new URLSearchParams(routeLocation.search).get('project') || '';
  const storedProjectId = activeProjectId || searchProjectId || localStorage.getItem(`csmv2_active_project_${actor.email}`) || '';
  const project = myProjects.find((p) => p.id === storedProjectId) || myProjects[0] || null;
  const projectTheme = project?.theme || baseTheme;
  const shouldShowWizard = showCreateWizard || myProjects.length === 0;

  function persist(next: SiteProject) {
    if (!project) return;
    setHistory((h) => [...h, project]);
    setFuture([]);
    const nextProject = project.status === 'published'
      ? { ...next, status: 'draft' as const, publishedAt: project.publishedAt }
      : next;
    upsertProject(nextProject);
    setRefresh((v) => v + 1);
  }

  function publishSite() {
    if (!project) return;
    const command = project.publishTarget === 'staging' ? 'publish-site-staging' : 'publish-site-production';
    const nextProject: SiteProject = { ...project, status: 'published', publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    upsertProject(nextProject);
    enqueueCommand(command, { project: nextProject, actor: actor.email });
    setRefresh((v) => v + 1);
    navigate(`/s/${nextProject.slug}`);
  }

  async function revertToPublishedSite() {
    if (!project) return;
    setRevertingToPublished(true);
    try {
      const published = await loadPublishedSiteSnapshot(project.slug);
      if (!published) {
        alert('No existe una version publicada para restaurar este sitio.');
        return;
      }
      persist({
        ...published,
        id: project.id,
        ownerEmail: project.ownerEmail,
        versions: project.versions,
        publishedAt: project.publishedAt || published.publishedAt,
        status: 'published',
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setRevertingToPublished(false);
    }
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

  async function startTemplateFromBase(template: SiteTemplate) {
    if (actor.role !== 'admin') return;
    setTemplateLoadingId(template.id);
    try {
      const blocks = template.blocks.some((block) => block.type === 'html')
        ? await materializeTemplateBlocks(template.blocks)
        : cloneBlocksWithNewIds(template.blocks);
      setEditingTemplateId('');
      setTemplateName(`${template.name} copia`);
      setTemplateBlocks(blocks);
      setPreviewTemplateId('');
      navigate('/app/templates');
    } finally {
      setTemplateLoadingId('');
    }
  }

  function saveSharedTemplate() {
    if (actor.role !== 'admin') return;
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
          <button type="button" className={`nav-site ${routeLocation.pathname === '/app/site' ? 'active' : ''}`} onClick={() => navigate('/app/site')}>Sitio</button>
          {actor.role === 'admin' && <button type="button" className={`nav-template ${routeLocation.pathname === '/app/templates' ? 'active' : ''}`} onClick={() => navigate('/app/templates')}>Crear plantilla</button>}
          <button type="button" className={`nav-admin ${routeLocation.pathname === '/app/admin' ? 'active' : ''}`} onClick={() => navigate('/app/admin')}>Administracion</button>
        </aside>

        <div className="studio-content wpwix-content">
          {routeLocation.pathname === '/app/site' && (
            <>
              <section className="site-library">
                <div className="site-library-head">
                  <div>
                    <h3>Mis sitios</h3>
                    <p>Administra tus borradores, URLs publicas y sitios publicados.</p>
                  </div>
                  <button type="button" onClick={() => { resetSiteWizard(); setShowCreateWizard(true); }}>Crear nuevo sitio</button>
                </div>
                {myProjects.length === 0 ? (
                  <div className="empty-inspector">Todavia no tienes sitios. Completa el wizard para crear el primero.</div>
                ) : (
                  <div className="site-card-list">
                    {myProjects.map((site) => (
                      <article key={site.id} className={`site-card ${project?.id === site.id ? 'active' : ''}`}>
                        <div>
                          <strong>{site.title}</strong>
                          <span>{site.status === 'published' ? 'Publicado y al dia' : site.publishedAt ? 'Borrador con version publicada' : 'Borrador sin publicar'} · /{site.slug}</span>
                        </div>
                        <input value={editUrl(site.id)} readOnly onFocus={(event) => event.currentTarget.select()} />
                        <input value={site.publishedAt ? publicUrl(site.slug) : 'Sin URL publicada aun'} readOnly onFocus={(event) => event.currentTarget.select()} />
                        <div className="site-card-actions">
                          <button type="button" onClick={() => selectProject(site.id)}>Abrir editor</button>
                          <button type="button" disabled={!site.publishedAt} onClick={() => window.open(publicUrl(site.slug), '_blank', 'noopener,noreferrer')}>Ver publicada</button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {shouldShowWizard ? (
                <section className="site-wizard">
                  <div className="wizard-copy">
                    <p className="eyebrow">Wizard de sitio</p>
                    <h2>Define nombre, SEO y plantilla antes de editar</h2>
                    <p>Estos datos se guardan con el sitio y ayudan a publicar una URL clara, con metadata util para buscadores y redes sociales.</p>
                  </div>
                  <div className="wizard-panel">
                    <div className="wizard-steps">
                      <button type="button" className={siteWizardStep === 1 ? 'active' : ''} onClick={() => setSiteWizardStep(1)}>1. Identidad</button>
                      <button type="button" className={siteWizardStep === 2 ? 'active' : ''} onClick={() => setSiteWizardStep(2)} disabled={!siteDraft.title.trim()}>2. SEO</button>
                      <button type="button" className={siteWizardStep === 3 ? 'active' : ''} onClick={() => setSiteWizardStep(3)} disabled={!siteDraft.title.trim()}>3. Plantilla</button>
                    </div>

                    {siteWizardStep === 1 && (
                      <div className="wizard-fields">
                        <label>Nombre del sitio<input value={siteDraft.title} onChange={(event) => {
                          const title = event.target.value;
                          updateSiteDraft({
                            title,
                            slug: siteSlugTouched ? siteDraft.slug : slugify(title),
                            seoTitle: siteDraft.seoTitle ? siteDraft.seoTitle : title,
                          });
                        }} placeholder="Landing de mi spa" /></label>
                        <label>Ruta publica<input value={siteDraft.slug} onChange={(event) => {
                          setSiteSlugTouched(true);
                          updateSiteDraft({ slug: slugify(event.target.value) });
                        }} placeholder="landing-spa" /></label>
                        <label>Descripcion corta<textarea value={siteDraft.description} onChange={(event) => {
                          const description = event.target.value;
                          updateSiteDraft({
                            description,
                            seoDescription: siteDraft.seoDescription ? siteDraft.seoDescription : description,
                          });
                        }} placeholder="Que ofrece este sitio y para quien existe." /></label>
                      </div>
                    )}

                    {siteWizardStep === 2 && (
                      <div className="wizard-fields">
                        <label>SEO title<input value={siteDraft.seoTitle} onChange={(event) => updateSiteDraft({ seoTitle: event.target.value })} placeholder="Titulo para Google" /></label>
                        <label>SEO description<textarea value={siteDraft.seoDescription} onChange={(event) => updateSiteDraft({ seoDescription: event.target.value })} placeholder="Descripcion que aparecera en buscadores." /></label>
                        <label>Keywords<input value={siteDraft.keywords} onChange={(event) => updateSiteDraft({ keywords: event.target.value })} placeholder="spa, masajes, bienestar" /></label>
                        <label>Imagen social / OG<input value={siteDraft.ogImage} onChange={(event) => updateSiteDraft({ ogImage: event.target.value })} placeholder="https://..." /></label>
                        <label>Destino de publicacion<select value={siteDraft.publishTarget} onChange={(event) => updateSiteDraft({ publishTarget: event.target.value as 'staging' | 'production' })}>
                          <option value="production">production</option>
                          <option value="staging">staging</option>
                        </select></label>
                      </div>
                    )}

                    {siteWizardStep === 3 && (
                      <div className="wizard-fields">
                        <p>Selecciona una plantilla inicial. Luego podras editar textos, estilos, funciones y secciones desde el canvas.</p>
                        <div className="template-list">
                          {templates.map((tpl) => (
                            <div key={tpl.id} className={`template-card ${siteDraft.templateId === tpl.id ? 'active' : ''}`}>
                              <strong>{tpl.name}</strong>
                              <button type="button" onClick={() => updateSiteDraft({ templateId: tpl.id })}>{siteDraft.templateId === tpl.id ? 'Seleccionada' : 'Seleccionar'}</button>
                              <button type="button" onClick={() => setPreviewTemplateId(tpl.id)}>Visualizar</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="wizard-actions">
                      {myProjects.length > 0 && <button type="button" onClick={() => setShowCreateWizard(false)}>Cancelar</button>}
                      <button type="button" disabled={siteWizardStep === 1} onClick={() => setSiteWizardStep((step) => Math.max(1, step - 1))}>Anterior</button>
                      {siteWizardStep < 3 ? (
                        <button type="button" disabled={!siteDraft.title.trim()} onClick={() => setSiteWizardStep((step) => Math.min(3, step + 1))}>Siguiente</button>
                      ) : (
                        <button type="button" disabled={!siteDraft.title.trim() || siteCreating} onClick={() => { void createSite(); }}>{siteCreating ? 'Creando...' : 'Crear sitio'}</button>
                      )}
                    </div>
                  </div>
                </section>
              ) : project ? (
                <>
                  <section className="seo-panel">
                    <h3>Sitio: {project.title}</h3>
                    <p>Estado de edicion: {project.status === 'published' ? 'publicado y sincronizado' : 'borrador de edicion'} · URL editor: {editUrl(project.id)}</p>
                    <p>Estado publico: {project.publishedAt ? `publicado por ultima vez ${new Date(project.publishedAt).toLocaleString()}` : 'sin publicacion aun'} · URL publica: {project.publishedAt ? publicUrl(project.slug) : 'todavia no disponible'}</p>
                    <div className="actions">
                      <button type="button" onClick={publishSite}>Publicar sitio</button>
                      <button type="button" disabled={revertingToPublished || !project.publishedAt} onClick={() => { void revertToPublishedSite(); }}>
                        {revertingToPublished ? 'Restaurando...' : 'Volver a publicado'}
                      </button>
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
                    <div className="seo-grid seo-grid-wide">
                      <label>Nombre<input value={project.title} onChange={(e) => persist({ ...project, title: e.target.value, updatedAt: new Date().toISOString() })} /></label>
                      <label>Descripcion sitio<input value={project.description} onChange={(e) => persist({ ...project, description: e.target.value, updatedAt: new Date().toISOString() })} /></label>
                      <label>SEO title<input value={project.seo.title} onChange={(e) => persist({ ...project, seo: { ...project.seo, title: e.target.value }, updatedAt: new Date().toISOString() })} /></label>
                      <label>SEO description<input value={project.seo.description} onChange={(e) => persist({ ...project, seo: { ...project.seo, description: e.target.value }, updatedAt: new Date().toISOString() })} /></label>
                      <label>Keywords<input value={project.seo.keywords.join(',')} onChange={(e) => persist({ ...project, seo: { ...project.seo, keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean) }, updatedAt: new Date().toISOString() })} /></label>
                      <label>OG image<input value={project.seo.ogImage || ''} onChange={(e) => persist({ ...project, seo: { ...project.seo, ogImage: e.target.value }, updatedAt: new Date().toISOString() })} /></label>
                      <label>Publicacion<select value={project.publishTarget} onChange={(e) => persist({ ...project, publishTarget: e.target.value as 'staging' | 'production' })}>
                        <option value="staging">staging</option>
                        <option value="production">production</option>
                      </select></label>
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

                  <Builder
                    blocks={project.blocks}
                    theme={projectTheme}
                    onUploadAsset={uploadSiteAsset}
                    onChange={(blocks) => persist({ ...project, blocks, updatedAt: new Date().toISOString() })}
                  />

                  <section className="templates">
                    <h3>Plantillas disponibles</h3>
                    <p>Los usuarios pueden seleccionar plantillas existentes para aplicarlas a su sitio. Crear plantillas nuevas queda reservado al administrador.</p>
                    <div className="template-list">
                      {templates.map((tpl) => (
                        <div key={tpl.id} className="template-card">
                          <strong>{tpl.name}</strong>
                          <button type="button" disabled={templateLoadingId === tpl.id} onClick={() => { void applyTemplate(tpl); }}>{templateLoadingId === tpl.id ? 'Preparando...' : 'Aplicar al sitio'}</button>
                          <button type="button" onClick={() => setPreviewTemplateId(tpl.id)}>Visualizar</button>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}
            </>
          )}

          {routeLocation.pathname === '/app/templates' && (actor.role === 'admin' ? (
            <section className="template-studio">
              <h3>Crear plantilla</h3>
              <p>Vista independiente para construir plantillas sin ruido de administración.</p>
              <div className="template-base-panel">
                <h4>Basar en plantilla existente</h4>
                <p>Elige una plantilla global o propia para crear una copia editable y guardarla como una nueva plantilla.</p>
                <div className="template-list owned-template-list">
                  {templates.map((tpl) => (
                    <div key={tpl.id} className="template-card">
                      <strong>{tpl.name}</strong>
                      <button type="button" disabled={templateLoadingId === tpl.id} onClick={() => { void startTemplateFromBase(tpl); }}>{templateLoadingId === tpl.id ? 'Preparando...' : 'Usar como base'}</button>
                      <button type="button" onClick={() => setPreviewTemplateId(tpl.id)}>Visualizar</button>
                    </div>
                  ))}
                </div>
              </div>
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
          ) : (
            <section className="template-studio">
              <h3>Acceso restringido</h3>
              <p>Solo el administrador puede crear o editar plantillas. Los usuarios pueden seleccionar plantillas existentes desde la seccion Sitio.</p>
              <button type="button" onClick={() => navigate('/app/site')}>Volver a sitios</button>
            </section>
          ))}

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

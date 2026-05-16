import { ArrowDown, ArrowUp, Copy, Eye, Layers, Monitor, Palette, Plus, Smartphone, Tablet, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SiteBlock, SiteTheme } from '../types/domain';

type Props = {
  blocks: SiteBlock[];
  onChange: (blocks: SiteBlock[]) => void;
  theme?: SiteTheme;
};

type PaletteItem = Omit<SiteBlock, 'id' | 'parentId' | 'nodeType'>;
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const sectionPalette: PaletteItem = {
  type: 'section',
  title: 'Nueva seccion',
  content: 'Contenedor principal',
  customClass: 'page',
};

const elementPalette: PaletteItem[] = [
  { type: 'navbar', title: 'Navbar', content: 'Inicio|Servicios|Contacto', items: ['Inicio', 'Servicios', 'Contacto'] },
  { type: 'hero', title: 'Hero', content: 'Construye sin limites', buttonText: 'Comenzar', buttonUrl: '#' },
  { type: 'text', title: 'Texto', content: 'Bloque de texto editable' },
  { type: 'features', title: 'Beneficios', content: 'Rapido, seguro, flexible', items: ['Sin backend', 'Publicacion GitHub', 'Plantillas'] },
  { type: 'gallery', title: 'Galeria', content: 'Muestra tus trabajos', items: ['https://picsum.photos/500/300', 'https://picsum.photos/501/300'] },
  { type: 'faq', title: 'FAQ', content: 'Preguntas frecuentes', items: ['Que incluye?:Editor visual completo', 'Como publico?:Con GitHub Actions'] },
  { type: 'image', title: 'Imagen', content: 'Hero visual', image: 'https://picsum.photos/1200/700' },
  { type: 'contactForm', title: 'Formulario', content: 'Recibe leads desde tu landing' },
  { type: 'cta', title: 'Llamado a la accion', content: 'Convierte visitas en clientes', buttonText: 'Contactar', buttonUrl: '#' },
];

const stylePresets = [
  { name: 'Minimal', css: 'background:#ffffff;color:#151515;padding:48px 32px;border-radius:0;' },
  { name: 'Editorial', css: 'background:#f8f1e7;color:#1f2937;padding:64px 40px;border-left:6px solid #d94f30;' },
  { name: 'SaaS', css: 'background:#eef6ff;color:#0f172a;padding:56px 36px;border-radius:18px;box-shadow:0 24px 60px #0f172a1f;' },
  { name: 'Bold', css: 'background:#111827;color:#ffffff;padding:64px 40px;border-radius:12px;' },
];

function toBuilderShape(blocks: SiteBlock[]): SiteBlock[] {
  const hasTree = blocks.some((b) => b.nodeType || b.type === 'section');
  if (hasTree) return blocks;
  const next: SiteBlock[] = [];
  for (const block of blocks) {
    const sectionId = crypto.randomUUID();
    next.push({ id: sectionId, type: 'section', nodeType: 'section', pageId: 'home', pageName: 'Home', customClass: 'page', title: `Seccion ${next.length + 1}`, content: '' });
    next.push({ ...block, id: crypto.randomUUID(), parentId: sectionId, nodeType: 'element', pageId: 'home', pageName: 'Home' });
  }
  return next;
}

function palettePayload(kind: 'section' | 'element', item?: PaletteItem): string {
  return JSON.stringify({ kind, item });
}

function updateBlock(blocks: SiteBlock[], id: string, patch: Partial<SiteBlock>): SiteBlock[] {
  return blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
}

function parseCssText(css?: string): React.CSSProperties | undefined {
  if (!css) return undefined;
  const entries = css
    .split(';')
    .map((rule) => rule.split(':').map((part) => part.trim()))
    .filter((rule) => rule.length >= 2 && rule[0]);
  return Object.fromEntries(entries.map(([key, ...value]) => [key, value.join(':')])) as React.CSSProperties;
}

function cloneWithChildren(blocks: SiteBlock[], source: SiteBlock): SiteBlock[] {
  const newId = crypto.randomUUID();
  const cloned = { ...source, id: newId, title: `${source.title} copia` };
  if (source.nodeType !== 'section' && source.type !== 'section') return blocks.concat(cloned);
  const children = blocks.filter((b) => b.parentId === source.id).map((child) => ({ ...child, id: crypto.randomUUID(), parentId: newId }));
  return blocks.concat(cloned, ...children);
}

export default function Builder({ blocks, onChange, theme }: Props) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const normalized = useMemo(() => toBuilderShape(blocks), [blocks]);
  const sections = normalized.filter((b) => b.nodeType === 'section' || b.type === 'section');
  const selected = normalized.find((b) => b.id === selectedId) || null;
  const pages = Array.from(new Map(sections.map((s) => [s.pageId || 'home', s.pageName || 'Home'])).entries()).map(([id, name]) => ({ id, name }));
  const childrenBySection = new Map<string, SiteBlock[]>();
  for (const section of sections) childrenBySection.set(section.id, normalized.filter((b) => b.parentId === section.id));

  function commit(next: SiteBlock[]) {
    onChange(next);
  }

  function removeBlock(id: string) {
    const target = normalized.find((b) => b.id === id);
    const next = target?.nodeType === 'section' || target?.type === 'section'
      ? normalized.filter((b) => b.id !== id && b.parentId !== id)
      : normalized.filter((b) => b.id !== id);
    setSelectedId('');
    commit(next);
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = normalized.findIndex((b) => b.id === id);
    if (index < 0) return;
    const target = normalized[index];
    const peers = normalized.filter((b) => (target.parentId ? b.parentId === target.parentId : b.nodeType === 'section' || b.type === 'section'));
    const peerIndex = peers.findIndex((b) => b.id === id);
    const swapPeer = peers[peerIndex + direction];
    if (!swapPeer) return;
    const swapIndex = normalized.findIndex((b) => b.id === swapPeer.id);
    const next = normalized.slice();
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    commit(next);
  }

  function onDropBody(event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/csmv2-item');
    if (!raw) return;
    const data = JSON.parse(raw) as { kind: 'section' | 'element'; item?: PaletteItem };
    if (data.kind !== 'section') return;
    const next: SiteBlock = {
      ...sectionPalette,
      id: crypto.randomUUID(),
      nodeType: 'section',
      pageId: 'home',
      pageName: 'Home',
    };
    setSelectedId(next.id);
    commit(normalized.concat(next));
  }

  function onDropSection(event: React.DragEvent<HTMLElement>, sectionId: string) {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/csmv2-item');
    if (!raw) return;
    const data = JSON.parse(raw) as { kind: 'section' | 'element'; item?: PaletteItem };
    if (data.kind !== 'element' || !data.item) return;
    const target = normalized.find((n) => n.id === sectionId);
    const element: SiteBlock = {
      ...data.item,
      id: crypto.randomUUID(),
      nodeType: 'element',
      parentId: sectionId,
      pageId: target?.pageId || 'home',
      pageName: target?.pageName || 'Home',
    };
    setSelectedId(element.id);
    commit(normalized.concat(element));
  }

  function addPage() {
    const pageName = prompt('Nombre de la nueva pagina') || '';
    if (!pageName.trim()) return;
    const pageId = pageName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const section: SiteBlock = {
      id: crypto.randomUUID(),
      nodeType: 'section',
      type: 'section',
      pageId,
      pageName: pageName.trim(),
      customClass: 'page',
      title: pageName.trim(),
      content: 'Nueva pagina SPA',
    };
    setSelectedId(section.id);
    commit(normalized.concat(section));
  }

  return (
    <section className="builder-shell">
      <aside className="builder-sidebar">
        <div className="builder-side-title"><Layers size={16} /> Componentes</div>
        <div
          className="palette-item"
          draggable
          onDragStart={(event) => event.dataTransfer.setData('application/csmv2-item', palettePayload('section', sectionPalette))}
        >
          <Plus size={15} /> Seccion
        </div>
        <button type="button" className="palette-item" onClick={addPage}><Plus size={15} /> Pagina SPA</button>
        <div className="page-strip">{pages.map((p) => <span key={p.id}>{p.name}</span>)}</div>
        {elementPalette.map((item) => (
          <div
            key={item.type + item.title}
            className="palette-item"
            draggable
            onDragStart={(event) => event.dataTransfer.setData('application/csmv2-item', palettePayload('element', item))}
          >
            <Plus size={15} /> {item.title}
          </div>
        ))}
      </aside>

      <main className={`builder-canvas canvas-${device}`} onDragOver={(event) => event.preventDefault()} onDrop={onDropBody}>
        <header className="canvas-toolbar">
          <strong><Eye size={16} /> Canvas</strong>
          <div className="device-switch">
            <button type="button" className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')} title="Desktop"><Monitor size={16} /></button>
            <button type="button" className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')} title="Tablet"><Tablet size={16} /></button>
            <button type="button" className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')} title="Mobile"><Smartphone size={16} /></button>
          </div>
        </header>

        <div
          className="page-frame"
          style={theme ? {
            background: theme.surface,
            color: theme.text,
            borderRadius: `${theme.radius}px`,
            fontFamily: theme.font,
          } : undefined}
        >
          {sections.length === 0 && <div className="drop-empty">Arrastra una seccion aqui.</div>}

          {sections.map((section, index) => {
            const items = childrenBySection.get(section.id) || [];
            return (
              <article
                key={section.id}
                className={`canvas-section ${selectedId === section.id ? 'selected' : ''}`}
                style={parseCssText(section.customCss)}
                onClick={(event) => { event.stopPropagation(); setSelectedId(section.id); }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDropSection(event, section.id)}
              >
                <div className="section-head">
                  <strong>Seccion {index + 1}: {section.title}</strong>
                  <div className="mini-actions">
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveBlock(section.id, -1); }} title="Subir"><ArrowUp size={15} /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveBlock(section.id, 1); }} title="Bajar"><ArrowDown size={15} /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); commit(cloneWithChildren(normalized, section)); }} title="Duplicar"><Copy size={15} /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); removeBlock(section.id); }} title="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </div>
                <h2
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => commit(updateBlock(normalized, section.id, { title: event.currentTarget.textContent || '' }))}
                >
                  {section.title}
                </h2>
                <p
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(event) => commit(updateBlock(normalized, section.id, { content: event.currentTarget.textContent || '' }))}
                >
                  {section.content}
                </p>

                <div className="section-children">
                  {items.length === 0 && <div className="drop-empty">Arrastra elementos aqui.</div>}
                  {items.map((block) => (
                    <article
                      key={block.id}
                      className={`block-card ${selectedId === block.id ? 'selected' : ''}`}
                      onClick={(event) => { event.stopPropagation(); setSelectedId(block.id); }}
                    >
                      <header>
                        <strong>{block.title}</strong>
                        <div className="mini-actions">
                          <button type="button" onClick={(event) => { event.stopPropagation(); moveBlock(block.id, -1); }} title="Subir"><ArrowUp size={15} /></button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); moveBlock(block.id, 1); }} title="Bajar"><ArrowDown size={15} /></button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); commit(cloneWithChildren(normalized, block)); }} title="Duplicar"><Copy size={15} /></button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); removeBlock(block.id); }} title="Eliminar"><Trash2 size={15} /></button>
                        </div>
                      </header>
                      <h3
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(event) => commit(updateBlock(normalized, block.id, { title: event.currentTarget.textContent || '' }))}
                      >
                        {block.title}
                      </h3>
                      <p
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(event) => commit(updateBlock(normalized, block.id, { content: event.currentTarget.textContent || '' }))}
                      >
                        {block.content}
                      </p>
                      {block.buttonText && <span className="fake-button">{block.buttonText}</span>}
                      {block.type === 'gallery' && <div className="mini-gallery">{(block.items || []).slice(0, 3).map((img) => <img key={img} src={img} alt="" />)}</div>}
                    </article>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </main>

      <aside className="inspector-panel">
        <div className="builder-side-title"><Palette size={16} /> Inspector</div>
        {!selected && <div className="empty-inspector">Selecciona una seccion o bloque.</div>}
        {selected && (
          <div className="inspector-fields">
            <label>Titulo<input value={selected.title} onChange={(e) => commit(updateBlock(normalized, selected.id, { title: e.target.value }))} /></label>
            <label>Contenido<textarea value={selected.content} onChange={(e) => commit(updateBlock(normalized, selected.id, { content: e.target.value }))} /></label>
            <div className="inline-fields">
              <label>Pagina<input value={selected.pageName || 'Home'} onChange={(e) => commit(updateBlock(normalized, selected.id, { pageName: e.target.value, pageId: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))} /></label>
              <label>Clase<input value={selected.customClass || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { customClass: e.target.value }))} /></label>
            </div>
            {(selected.type === 'cta' || selected.type === 'hero') && (
              <div className="inline-fields">
                <label>Boton<input value={selected.buttonText || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { buttonText: e.target.value }))} /></label>
                <label>URL<input value={selected.buttonUrl || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { buttonUrl: e.target.value }))} /></label>
              </div>
            )}
            {(selected.type === 'gallery' || selected.type === 'faq' || selected.type === 'features' || selected.type === 'navbar') && (
              <label>Items<textarea value={(selected.items || []).join('\n')} onChange={(e) => commit(updateBlock(normalized, selected.id, { items: e.target.value.split('\n').filter(Boolean) }))} /></label>
            )}
            {selected.type === 'image' && <label>Imagen<input value={selected.image || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { image: e.target.value }))} /></label>}
            <div className="style-presets">
              {stylePresets.map((preset) => (
                <button key={preset.name} type="button" onClick={() => commit(updateBlock(normalized, selected.id, { customCss: preset.css }))}>{preset.name}</button>
              ))}
            </div>
            <label>CSS<textarea value={selected.customCss || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { customCss: e.target.value }))} /></label>
            <label>JS<textarea value={selected.customJs || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { customJs: e.target.value }))} /></label>
          </div>
        )}
      </aside>
    </section>
  );
}

import { ArrowDown, ArrowUp, Copy, Eye, Layers, Monitor, Palette, Plus, Smartphone, Tablet, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { composeFrameHtml, serializeFrameDocument } from '../lib/htmlTemplates';
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
  { type: 'html', title: 'HTML embebido', content: 'Iframe o HTML completo', embedUrl: `${import.meta.env.BASE_URL}templates/labspa/index.html` },
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

type HtmlNodeSelection = {
  editId: string;
  tagName: string;
  label: string;
  text: string;
  href: string;
  onclick: string;
  actionName: string;
};

function getEditableHtmlTarget(target: EventTarget | null): HTMLElement | null {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return null;
  const interactive = element.closest<HTMLElement>('a,button,[role="button"],input[type="button"],input[type="submit"]');
  if (interactive) return interactive;
  return element.closest<HTMLElement>('h1,h2,h3,h4,h5,h6,p,span,li,label,small,strong,em') || element;
}

function isInputLike(element: HTMLElement): boolean {
  return ['input', 'textarea'].includes(element.tagName.toLowerCase());
}

function isAnchor(element: HTMLElement): boolean {
  return element.tagName.toLowerCase() === 'a';
}

function getElementText(element: HTMLElement): string {
  if (isInputLike(element)) return (element as HTMLInputElement | HTMLTextAreaElement).value;
  return element.textContent?.trim() || '';
}

function setElementText(element: HTMLElement, value: string): void {
  if (isInputLike(element)) {
    (element as HTMLInputElement | HTMLTextAreaElement).value = value;
    element.setAttribute('value', value);
    return;
  }
  element.textContent = value;
}

function getElementHref(element: HTMLElement): string {
  if (isAnchor(element)) return element.getAttribute('href') || '';
  if (element.tagName.toLowerCase() === 'button') return element.getAttribute('data-href') || '';
  return element.getAttribute('href') || element.getAttribute('data-href') || '';
}

function setElementHref(element: HTMLElement, value: string): void {
  if (isAnchor(element)) element.setAttribute('href', value || '#');
  else if (value) element.setAttribute('data-href', value);
  else element.removeAttribute('data-href');
}

function actionNameFromOnclick(onclick: string): string {
  return onclick.match(/csmv2RunAction\(['"]([^'"]+)['"]/)?.[1] || onclick.match(/(?:return\s+)?(?:window\.)?([A-Za-z_$][\w$]*)\s*\(/)?.[1] || '';
}

function readHtmlNode(element: HTMLElement): HtmlNodeSelection {
  const onclick = element.getAttribute('onclick') || '';
  return {
    editId: element.dataset.csmv2EditId || '',
    tagName: element.tagName.toLowerCase(),
    label: [element.tagName.toLowerCase(), element.id ? `#${element.id}` : '', element.className ? `.${String(element.className).trim().split(/\s+/).slice(0, 2).join('.')}` : ''].join(''),
    text: getElementText(element),
    href: getElementHref(element),
    onclick,
    actionName: element.dataset.csmv2Action || actionNameFromOnclick(onclick),
  };
}

function extractFunctionNames(js: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g,
    /window\.([A-Za-z_$][\w$]*)\s*=/g,
  ];
  for (const pattern of patterns) {
    let match = pattern.exec(js);
    while (match) {
      if (match[1]) names.add(match[1]);
      match = pattern.exec(js);
    }
  }
  return Array.from(names).sort();
}

function extractInlineScripts(html?: string): string {
  if (!html) return '';
  const scripts: string[] = [];
  const pattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match = pattern.exec(html);
  while (match) {
    scripts.push(match[1] || '');
    match = pattern.exec(html);
  }
  return scripts.join('\n');
}

function safeFunctionName(value: string): string {
  const cleaned = value.trim().replace(/[^A-Za-z0-9_$]/g, '_').replace(/^([^A-Za-z_$])/, '_$1');
  return cleaned || `accion_${Date.now()}`;
}

function EditableHtmlFrame({ block, onSave }: { block: SiteBlock; onSave: (patch: Partial<SiteBlock>) => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedNode, setSelectedNode] = useState<HtmlNodeSelection | null>(null);
  const [scriptDraft, setScriptDraft] = useState(block.htmlJs || '');
  const [newFunctionName, setNewFunctionName] = useState('');
  const srcDoc = composeFrameHtml(block, true);
  const functionNames = useMemo(() => extractFunctionNames(`${extractInlineScripts(block.html)}\n${scriptDraft}`), [block.html, scriptDraft]);
  const functionOptions = selectedNode?.actionName && !functionNames.includes(selectedNode.actionName) ? [selectedNode.actionName, ...functionNames] : functionNames;

  useEffect(() => {
    setScriptDraft(block.htmlJs || '');
  }, [block.id, block.htmlJs]);

  function prepareEditor(frame: HTMLIFrameElement) {
    const doc = frame.contentDocument;
    if (!doc || !srcDoc) return;
    doc.designMode = 'off';
    doc.querySelectorAll<HTMLElement>('a,button,[role="button"],input[type="button"],input[type="submit"],h1,h2,h3,h4,h5,h6,p,span,li,label,small,strong,em').forEach((element, index) => {
      element.dataset.csmv2EditId = `node-${index}`;
      if (!isInputLike(element)) element.setAttribute('contenteditable', 'true');
    });
    doc.addEventListener('click', (event) => {
      const element = getEditableHtmlTarget(event.target);
      if (!element) return;
      if (element.closest('a,button,[role="button"],input[type="button"],input[type="submit"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      doc.querySelectorAll('.csmv2-node-selected').forEach((node) => node.classList.remove('csmv2-node-selected'));
      element.classList.add('csmv2-node-selected');
      setSelectedNode(readHtmlNode(element));
    }, true);
    doc.addEventListener('submit', (event) => event.preventDefault(), true);
    doc.addEventListener('input', (event) => {
      setDirty(true);
      const element = getEditableHtmlTarget(event.target);
      if (element?.dataset.csmv2EditId) setSelectedNode(readHtmlNode(element));
    });
  }

  function getSelectedElement(): HTMLElement | null {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !selectedNode) return null;
    return doc.querySelector<HTMLElement>(`[data-csmv2-edit-id="${selectedNode.editId}"]`);
  }

  function patchSelectedElement(patch: Partial<Pick<HtmlNodeSelection, 'text' | 'href' | 'actionName'>>): void {
    const element = getSelectedElement();
    if (!element || !selectedNode) return;
    if (patch.text !== undefined) setElementText(element, patch.text);
    if (patch.href !== undefined) setElementHref(element, patch.href);
    if (patch.actionName !== undefined) {
      const action = patch.actionName.trim();
      if (action) {
        element.dataset.csmv2Action = action;
        element.setAttribute('onclick', `return window.csmv2RunAction('${action}', event, this);`);
      } else {
        element.removeAttribute('data-csmv2-action');
        if (actionNameFromOnclick(element.getAttribute('onclick') || '')) element.removeAttribute('onclick');
      }
    }
    setSelectedNode(readHtmlNode(element));
    setDirty(true);
  }

  function addFunctionAndSelect() {
    const name = safeFunctionName(newFunctionName);
    const existing = extractFunctionNames(scriptDraft);
    const nextDraft = existing.includes(name)
      ? scriptDraft
      : `${scriptDraft.trim()}\n\nfunction ${name}(event, element) {\n  event.preventDefault();\n  console.log('${name}', element);\n  return false;\n}\n`.trim();
    setScriptDraft(nextDraft);
    setNewFunctionName('');
    patchSelectedElement({ actionName: name });
    setDirty(true);
  }

  function saveVisualChanges() {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    onSave({ html: serializeFrameDocument(doc), htmlJs: scriptDraft });
    setDirty(false);
  }

  return (
    <div className="embedded-template-editor">
      <iframe
        ref={frameRef}
        title={block.title}
        src={srcDoc ? undefined : block.embedUrl}
        srcDoc={srcDoc}
        scrolling="no"
        sandbox="allow-same-origin allow-scripts allow-forms"
        onLoad={(event) => prepareEditor(event.currentTarget)}
      />
      <div className="html-edit-toolbar">
        <span>{srcDoc ? 'Modo edicion: scripts, enlaces y formularios quedan bloqueados. Selecciona textos o botones para editarlos.' : 'Este bloque usa una URL externa. Usa una plantilla desde el catalogo para editarla.'}</span>
        <button type="button" disabled={!srcDoc} onClick={saveVisualChanges}>{dirty ? 'Guardar cambios visuales' : 'Guardar HTML'}</button>
      </div>
      {srcDoc && (
        <div className="html-node-panel">
          <div className="html-node-head">
            <strong>{selectedNode ? `Elemento: ${selectedNode.label}` : 'Selecciona un texto, link o boton dentro de la plantilla'}</strong>
            {selectedNode?.actionName && <span>Funcion conectada: {selectedNode.actionName}</span>}
          </div>
          {selectedNode ? (
            <>
              <label>Texto visible<input value={selectedNode.text} onChange={(event) => patchSelectedElement({ text: event.target.value })} /></label>
              <label>URL / destino<input value={selectedNode.href} onChange={(event) => patchSelectedElement({ href: event.target.value })} placeholder="#contacto, https://..., mailto:..." /></label>
              <div className="inline-fields">
                <label>Funcion<select value={selectedNode.actionName} onChange={(event) => patchSelectedElement({ actionName: event.target.value })}>
                  <option value="">Sin funcion</option>
                  {functionOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select></label>
                <label>Nueva funcion<input value={newFunctionName} onChange={(event) => setNewFunctionName(event.target.value)} placeholder="enviarLead" /></label>
              </div>
              <button type="button" onClick={addFunctionAndSelect}>Crear y conectar funcion</button>
              <label>Onclick detectado<input value={selectedNode.onclick} readOnly /></label>
            </>
          ) : (
            <p>En esta vista los botones no ejecutan acciones. La funcion solo se ejecutara en Visualizar o en el sitio publicado.</p>
          )}
          <label>Funciones JS del sitio<textarea value={scriptDraft} onChange={(event) => { setScriptDraft(event.target.value); setDirty(true); }} placeholder="function enviarLead(event, element) { return false; }" /></label>
        </div>
      )}
      <p>{block.content}</p>
    </div>
  );
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
            const isEmbeddedTemplate = section.type === 'html' && (section.embedUrl || section.html);
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
                {isEmbeddedTemplate ? (
                  <EditableHtmlFrame
                    block={section}
                    onSave={(patch) => commit(updateBlock(normalized, section.id, patch))}
                  />
                ) : (
                  <>
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
                          {block.type === 'html' && (block.embedUrl || block.html) && (
                            <iframe className="block-embed-preview" title={block.title} src={composeFrameHtml(block) ? undefined : block.embedUrl} srcDoc={composeFrameHtml(block)} />
                          )}
                          {block.buttonText && <span className="fake-button">{block.buttonText}</span>}
                          {block.type === 'gallery' && <div className="mini-gallery">{(block.items || []).slice(0, 3).map((img) => <img key={img} src={img} alt="" />)}</div>}
                        </article>
                      ))}
                    </div>
                  </>
                )}
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
            {selected.type === 'html' && (
              <>
                <label>URL original<input value={selected.sourceUrl || selected.embedUrl || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { embedUrl: e.target.value, sourceUrl: e.target.value }))} /></label>
                <label>CSS de la plantilla<textarea value={selected.htmlCss || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { htmlCss: e.target.value }))} /></label>
                <label>JS de la plantilla<textarea value={selected.htmlJs || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { htmlJs: e.target.value }))} /></label>
                <label>HTML completo<textarea value={selected.html || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { html: e.target.value }))} /></label>
              </>
            )}
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

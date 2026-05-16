import { ArrowDown, ArrowUp, Copy, Eye, Layers, Monitor, Palette, Plus, Smartphone, Tablet, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { composeFrameHtml, serializeFrameDocument } from '../lib/htmlTemplates';
import type { SiteBlock, SiteTheme } from '../types/domain';
import { resolveUploadedAssetUrl } from '../lib/storage';

type Props = {
  blocks: SiteBlock[];
  onChange: (blocks: SiteBlock[]) => void;
  theme?: SiteTheme;
  onUploadAsset?: (file: File, hint?: string) => Promise<string>;
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
  { type: 'carousel', title: 'Carrusel', content: 'Slides principales del sitio', items: ['https://picsum.photos/1200/700?1|Bienestar premium|Experiencias pensadas para convertir', 'https://picsum.photos/1200/700?2|Resultados visibles|Campanas visuales con narrativa clara'] },
  { type: 'table', title: 'Tabla', content: 'Comparativa de servicios y precios', items: ['Servicio|Duracion|Precio', 'Masaje relajante|60 min|$80', 'Facial premium|45 min|$65'] },
  { type: 'pricing', title: 'Precios', content: 'Planes comerciales o paquetes destacados', items: ['Starter|$19/mes|1 sitio,Soporte base,Analitica esencial', 'Growth|$49/mes|3 sitios,SEO avanzado,Automatizaciones'] },
  { type: 'testimonials', title: 'Testimonios', content: 'Prueba social para aumentar conversion', items: ['Ana Torres|CEO de Wellness|Duplicamos conversiones en dos semanas', 'Luis Mejia|Founder de Studio Norte|El editor nos ahorro horas cada semana'] },
  { type: 'image', title: 'Imagen', content: 'Hero visual', image: 'https://picsum.photos/1200/700' },
  { type: 'video', title: 'Video', content: 'Presentacion del producto o demo principal', embedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', image: 'https://picsum.photos/1200/700?video' },
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
  src: string;
  alt: string;
  title: string;
  target: string;
  idValue: string;
  className: string;
  inlineStyle: string;
  onclick: string;
  actionName: string;
  cssText: string;
  attributesText: string;
  eventsText: string;
  ancestryText: string;
  parentEditId: string;
};

const HTML_EVENT_ATTRIBUTES = ['onclick', 'ondblclick', 'onchange', 'oninput', 'onsubmit', 'onfocus', 'onblur', 'onmouseenter', 'onmouseleave', 'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup'];

function getEditableHtmlTarget(target: EventTarget | null): HTMLElement | null {
  const element = target as HTMLElement | null;
  if (!element || typeof element.closest !== 'function') return null;
  return element.closest<HTMLElement>('img,a,button,[role="button"],input,textarea,select,option,video,source,iframe,svg,path,section,article,div,h1,h2,h3,h4,h5,h6,p,span,li,label,small,strong,em') || element;
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
  const anchor = element.closest('a');
  if (anchor) return anchor.getAttribute('href') || '';
  if (element.tagName.toLowerCase() === 'button') return element.getAttribute('data-href') || '';
  return element.getAttribute('href') || element.getAttribute('data-href') || '';
}

function setElementHref(element: HTMLElement, value: string): void {
  if (isAnchor(element)) element.setAttribute('href', value || '#');
  else if (element.closest('a')) element.closest('a')?.setAttribute('href', value || '#');
  else if (value) element.setAttribute('data-href', value);
  else element.removeAttribute('data-href');
}

function getElementSrc(element: HTMLElement): string {
  if (['img', 'iframe', 'source', 'audio', 'video', 'script'].includes(element.tagName.toLowerCase())) {
    return element.getAttribute('src') || '';
  }
  return '';
}

function setElementSrc(element: HTMLElement, value: string): void {
  if (['img', 'iframe', 'source', 'audio', 'video', 'script'].includes(element.tagName.toLowerCase())) {
    if (value.trim()) element.setAttribute('src', value.trim());
    else element.removeAttribute('src');
  }
}

function normalizeClassName(value: string): string {
  return value.trim().split(/\s+/).filter(Boolean).join(' ');
}

function readMatchedCss(element: HTMLElement): string {
  const doc = element.ownerDocument;
  if (!doc) return '';
  const matches: string[] = [];
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule)) continue;
      try {
        if (element.matches(rule.selectorText)) matches.push(`${rule.selectorText} { ${rule.style.cssText} }`);
      } catch {
        /* Invalid selector from external libraries should not stop inspection. */
      }
    }
  }
  return matches.join('\n\n');
}

function formatElementLabel(element: HTMLElement): string {
  return [
    element.tagName.toLowerCase(),
    element.id ? `#${element.id}` : '',
    element.className ? `.${String(element.className).trim().split(/\s+/).slice(0, 2).join('.')}` : '',
  ].join('');
}

function readElementAttributes(element: HTMLElement): string {
  const pairs = Array.from(element.attributes)
    .filter((attribute) => !['data-csmv2-edit-id', 'contenteditable'].includes(attribute.name))
    .map((attribute) => `${attribute.name}="${attribute.value}"`);
  return pairs.join('\n');
}

function readElementEvents(element: HTMLElement): string {
  const entries: string[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;
  while (current && depth < 4) {
    const events = HTML_EVENT_ATTRIBUTES
      .map((name) => {
        const value = current?.getAttribute(name) || '';
        return value ? `${name}="${value}"` : '';
      })
      .filter(Boolean);
    if (events.length) entries.push(`${formatElementLabel(current)}\n${events.join('\n')}`);
    current = current.parentElement;
    depth += 1;
  }
  return entries.join('\n\n');
}

function readElementAncestry(element: HTMLElement): string {
  const path: string[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;
  while (current && current.tagName.toLowerCase() !== 'body' && depth < 6) {
    path.push(formatElementLabel(current));
    current = current.parentElement;
    depth += 1;
  }
  return path.join('\n');
}

function actionNameFromOnclick(onclick: string): string {
  return onclick.match(/csmv2RunAction\(['"]([^'"]+)['"]/)?.[1] || onclick.match(/(?:return\s+)?(?:window\.)?([A-Za-z_$][\w$]*)\s*\(/)?.[1] || '';
}

function readHtmlNode(element: HTMLElement): HtmlNodeSelection {
  const onclick = element.getAttribute('onclick') || '';
  return {
    editId: element.dataset.csmv2EditId || '',
    tagName: element.tagName.toLowerCase(),
    label: formatElementLabel(element),
    text: getElementText(element),
    href: getElementHref(element),
    src: getElementSrc(element),
    alt: element.getAttribute('alt') || '',
    title: element.getAttribute('title') || '',
    target: isAnchor(element) ? element.getAttribute('target') || '' : element.closest('a')?.getAttribute('target') || '',
    idValue: element.id || '',
    className: normalizeClassName(element.className || ''),
    inlineStyle: element.getAttribute('style') || '',
    onclick,
    actionName: element.dataset.csmv2Action || actionNameFromOnclick(onclick),
    cssText: readMatchedCss(element),
    attributesText: readElementAttributes(element),
    eventsText: readElementEvents(element),
    ancestryText: readElementAncestry(element),
    parentEditId: element.parentElement?.dataset.csmv2EditId || '',
  };
}

function setElementAttribute(element: HTMLElement, attribute: string, value: string): void {
  const nextValue = value.trim();
  if (attribute === 'href') {
    setElementHref(element, value);
    return;
  }
  if (attribute === 'src') {
    setElementSrc(element, value);
    return;
  }
  if (attribute === 'class') {
    if (nextValue) element.className = normalizeClassName(nextValue);
    else element.removeAttribute('class');
    return;
  }
  if (attribute === 'style') {
    if (nextValue) element.setAttribute('style', nextValue);
    else element.removeAttribute('style');
    return;
  }
  if (attribute === 'id') {
    element.id = nextValue;
    if (!nextValue) element.removeAttribute('id');
    return;
  }
  if (attribute === 'target' && !isAnchor(element) && element.closest('a')) {
    const anchor = element.closest('a');
    if (anchor) {
      if (nextValue) anchor.setAttribute('target', nextValue);
      else anchor.removeAttribute('target');
    }
    return;
  }
  if (attribute === 'title' && !isAnchor(element) && element.closest('a')?.querySelector('img') === element) {
    if (nextValue) element.setAttribute('title', nextValue);
    else element.removeAttribute('title');
    return;
  }
  if (nextValue) element.setAttribute(attribute, nextValue);
  else element.removeAttribute(attribute);
}

function parseTableRows(items?: string[]): string[][] {
  return (items || [])
    .map((row) => row.split('|').map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));
}

function parseCarouselSlides(items?: string[]): Array<{ image: string; title: string; text: string }> {
  return (items || [])
    .map((item) => {
      const [image = '', title = '', text = ''] = item.split('|');
      return { image: image.trim(), title: title.trim(), text: text.trim() };
    })
    .filter((slide) => slide.image || slide.title || slide.text);
}

function parsePricingCards(items?: string[]): Array<{ name: string; price: string; features: string[] }> {
  return (items || [])
    .map((item) => {
      const [name = '', price = '', featuresRaw = ''] = item.split('|');
      return {
        name: name.trim(),
        price: price.trim(),
        features: featuresRaw.split(',').map((feature) => feature.trim()).filter(Boolean),
      };
    })
    .filter((card) => card.name || card.price || card.features.length);
}

function parseTestimonials(items?: string[]): Array<{ author: string; role: string; quote: string }> {
  return (items || [])
    .map((item) => {
      const [author = '', role = '', quote = ''] = item.split('|');
      return { author: author.trim(), role: role.trim(), quote: quote.trim() };
    })
    .filter((item) => item.author || item.role || item.quote);
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

function EditableHtmlFrame({
  block,
  onSave,
  onUploadAsset,
}: {
  block: SiteBlock;
  onSave: (patch: Partial<SiteBlock>) => void;
  onUploadAsset?: (file: File, hint?: string) => Promise<string>;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedNode, setSelectedNode] = useState<HtmlNodeSelection | null>(null);
  const [scriptDraft, setScriptDraft] = useState(block.htmlJs || '');
  const [newFunctionName, setNewFunctionName] = useState('');
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const srcDoc = composeFrameHtml(block, true);
  const functionNames = useMemo(() => extractFunctionNames(`${extractInlineScripts(block.html)}\n${scriptDraft}`), [block.html, scriptDraft]);
  const functionOptions = selectedNode?.actionName && !functionNames.includes(selectedNode.actionName) ? [selectedNode.actionName, ...functionNames] : functionNames;

  useEffect(() => {
    setScriptDraft(block.htmlJs || '');
    setSelectedNode(null);
  }, [block.id, block.htmlJs]);

  function prepareEditor(frame: HTMLIFrameElement) {
    const doc = frame.contentDocument;
    if (!doc || !srcDoc) return;
    doc.designMode = 'off';
    doc.querySelectorAll<HTMLElement>('body *').forEach((element, index) => {
      if (['script', 'style', 'link', 'meta', 'head', 'html', 'body'].includes(element.tagName.toLowerCase())) return;
      element.dataset.csmv2EditId = `node-${index}`;
      if (!isInputLike(element) && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'li', 'label', 'small', 'strong', 'em', 'td', 'th', 'caption', 'button', 'a'].includes(element.tagName.toLowerCase())) {
        element.setAttribute('contenteditable', 'true');
      }
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

  function selectNodeByEditId(editId: string): void {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !editId) return;
    const element = doc.querySelector<HTMLElement>(`[data-csmv2-edit-id="${editId}"]`);
    if (!element) return;
    doc.querySelectorAll('.csmv2-node-selected').forEach((node) => node.classList.remove('csmv2-node-selected'));
    element.classList.add('csmv2-node-selected');
    setSelectedNode(readHtmlNode(element));
  }

  function patchSelectedElement(patch: Partial<Pick<HtmlNodeSelection, 'text' | 'href' | 'src' | 'alt' | 'title' | 'target' | 'idValue' | 'className' | 'inlineStyle' | 'actionName'>>): void {
    const element = getSelectedElement();
    if (!element || !selectedNode) return;
    if (patch.text !== undefined) setElementText(element, patch.text);
    if (patch.href !== undefined) setElementAttribute(element, 'href', patch.href);
    if (patch.src !== undefined) setElementAttribute(element, 'src', patch.src);
    if (patch.alt !== undefined) setElementAttribute(element, 'alt', patch.alt);
    if (patch.title !== undefined) setElementAttribute(element, 'title', patch.title);
    if (patch.target !== undefined) setElementAttribute(element, 'target', patch.target);
    if (patch.idValue !== undefined) setElementAttribute(element, 'id', patch.idValue);
    if (patch.className !== undefined) setElementAttribute(element, 'class', patch.className);
    if (patch.inlineStyle !== undefined) setElementAttribute(element, 'style', patch.inlineStyle);
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

  function requestNodeImageUpload() {
    if (!onUploadAsset || selectedNode?.tagName !== 'img') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingAsset(true);
      try {
        const url = await onUploadAsset(file, selectedNode.idValue || selectedNode.label || 'html-image');
        patchSelectedElement({ src: url, alt: selectedNode.alt || file.name.replace(/\.[^.]+$/, '') });
      } catch (error) {
        alert(error instanceof Error ? error.message : 'No se pudo subir la imagen');
      } finally {
        setUploadingAsset(false);
      }
    };
    input.click();
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
            <strong>{selectedNode ? `Elemento: ${selectedNode.label}` : 'Selecciona cualquier nodo visible dentro de la plantilla'}</strong>
            {selectedNode?.actionName && <span>Funcion conectada: {selectedNode.actionName}</span>}
          </div>
          {selectedNode ? (
            <>
              <div className="inline-fields">
                <label>Tag<input value={selectedNode.tagName} readOnly /></label>
                <label>ID<input value={selectedNode.idValue} onChange={(event) => patchSelectedElement({ idValue: event.target.value })} placeholder="hero-main" /></label>
              </div>
              <label>Class<input value={selectedNode.className} onChange={(event) => patchSelectedElement({ className: event.target.value })} placeholder="btn btn-primary" /></label>
              <label>Style inline<textarea value={selectedNode.inlineStyle} onChange={(event) => patchSelectedElement({ inlineStyle: event.target.value })} placeholder="color:#111;background:#fff;" /></label>
              <label>Texto visible<textarea value={selectedNode.text} onChange={(event) => patchSelectedElement({ text: event.target.value })} /></label>
              <div className="inline-fields">
                <label>URL / href<input value={selectedNode.href} onChange={(event) => patchSelectedElement({ href: event.target.value })} placeholder="#contacto, https://..., mailto:..." /></label>
                <label>Source / src<input value={selectedNode.src} onChange={(event) => patchSelectedElement({ src: event.target.value })} placeholder="https://..." /></label>
              </div>
              <div className="inline-fields">
                <label>Alt<input value={selectedNode.alt} onChange={(event) => patchSelectedElement({ alt: event.target.value })} placeholder="Descripcion de imagen" /></label>
                <label>Title<input value={selectedNode.title} onChange={(event) => patchSelectedElement({ title: event.target.value })} placeholder="Tooltip o titulo" /></label>
              </div>
              <div className="inline-fields">
                <label>Target<input value={selectedNode.target} onChange={(event) => patchSelectedElement({ target: event.target.value })} placeholder="_blank" /></label>
                <label>Funcion<select value={selectedNode.actionName} onChange={(event) => patchSelectedElement({ actionName: event.target.value })}>
                  <option value="">Sin funcion</option>
                  {functionOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select></label>
              </div>
              <div className="inline-fields">
                <label>Nueva funcion<input value={newFunctionName} onChange={(event) => setNewFunctionName(event.target.value)} placeholder="enviarLead" /></label>
                <label>Onclick detectado<input value={selectedNode.onclick} readOnly /></label>
              </div>
              <div className="inline-fields">
                <button type="button" disabled={!selectedNode.parentEditId} onClick={() => selectNodeByEditId(selectedNode.parentEditId)}>Seleccionar padre</button>
                <div className="html-node-meta">
                  <strong>Jerarquia</strong>
                  <span>{selectedNode.label}</span>
                </div>
              </div>
              {selectedNode.tagName === 'img' && (
                <button type="button" disabled={!onUploadAsset || uploadingAsset} onClick={requestNodeImageUpload}>
                  {uploadingAsset ? 'Subiendo imagen...' : 'Subir imagen para este nodo'}
                </button>
              )}
              <button type="button" onClick={addFunctionAndSelect}>Crear y conectar funcion</button>
              <label>Jerarquia del nodo<textarea value={selectedNode.ancestryText} readOnly placeholder="Nodo actual y ancestros" /></label>
              <label>Eventos detectados<textarea value={selectedNode.eventsText} readOnly placeholder="Eventos inline del nodo y ancestros cercanos" /></label>
              <label>Atributos detectados<textarea value={selectedNode.attributesText} readOnly placeholder="Atributos reales del nodo" /></label>
              <label>CSS detectado<textarea value={selectedNode.cssText} readOnly placeholder="Reglas CSS asociadas por selector" /></label>
            </>
          ) : (
            <p>En esta vista los enlaces, botones y formularios no ejecutan acciones. El objetivo aqui es inspeccionar y editar atributos reales del HTML.</p>
          )}
          <label>Funciones JS del sitio<textarea value={scriptDraft} onChange={(event) => { setScriptDraft(event.target.value); setDirty(true); }} placeholder="function enviarLead(event, element) { return false; }" /></label>
        </div>
      )}
      <p>{block.content}</p>
    </div>
  );
}

export default function Builder({ blocks, onChange, theme, onUploadAsset }: Props) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const normalized = useMemo(() => toBuilderShape(blocks), [blocks]);
  const sections = normalized.filter((b) => b.nodeType === 'section' || b.type === 'section');
  const selected = normalized.find((b) => b.id === selectedId) || null;
  const pages = Array.from(new Map(sections.map((s) => [s.pageId || 'home', s.pageName || 'Home'])).entries()).map(([id, name]) => ({ id, name }));
  const childrenBySection = new Map<string, SiteBlock[]>();
  for (const section of sections) childrenBySection.set(section.id, normalized.filter((b) => b.parentId === section.id));

  function commit(next: SiteBlock[]) {
    onChange(next);
  }

  function requestAssetUpload(onUrl: (url: string) => void, hint?: string) {
    if (!onUploadAsset) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingAsset(true);
      try {
        const url = await onUploadAsset(file, hint);
        onUrl(url);
      } catch (error) {
        alert(error instanceof Error ? error.message : 'No se pudo subir la imagen');
      } finally {
        setUploadingAsset(false);
      }
    };
    input.click();
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
                    onUploadAsset={onUploadAsset}
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
                          {block.type === 'gallery' && <div className="mini-gallery">{(block.items || []).slice(0, 3).map((img) => <img key={img} src={resolveUploadedAssetUrl(img)} alt="" />)}</div>}
                          {block.type === 'carousel' && (
                            <div className="mini-carousel">
                              {parseCarouselSlides(block.items).slice(0, 2).map((slide, index) => (
                                <div key={`${block.id}-slide-${index}`} className="mini-carousel-slide">
                                  {slide.image && <img src={resolveUploadedAssetUrl(slide.image)} alt={slide.title || `slide-${index + 1}`} />}
                                  <strong>{slide.title || `Slide ${index + 1}`}</strong>
                                </div>
                              ))}
                            </div>
                          )}
                          {block.type === 'table' && (
                            <div className="mini-table">
                              {parseTableRows(block.items).map((row, rowIndex) => (
                                <div key={`${block.id}-row-${rowIndex}`} className="mini-table-row">
                                  {row.map((cell, cellIndex) => <span key={`${block.id}-cell-${rowIndex}-${cellIndex}`}>{cell}</span>)}
                                </div>
                              ))}
                            </div>
                          )}
                          {block.type === 'pricing' && (
                            <div className="mini-pricing">
                              {parsePricingCards(block.items).slice(0, 2).map((card, index) => (
                                <div key={`${block.id}-pricing-${index}`} className="mini-pricing-card">
                                  <strong>{card.name || `Plan ${index + 1}`}</strong>
                                  <span>{card.price}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {block.type === 'testimonials' && (
                            <div className="mini-testimonials">
                              {parseTestimonials(block.items).slice(0, 2).map((item, index) => (
                                <div key={`${block.id}-testimonial-${index}`} className="mini-testimonial">
                                  <p>{item.quote}</p>
                                  <strong>{item.author}</strong>
                                </div>
                              ))}
                            </div>
                          )}
                          {block.type === 'video' && (
                            <div className="mini-video">
                              {block.image && <img src={resolveUploadedAssetUrl(block.image)} alt={block.title} />}
                              <span>{block.embedUrl || 'Sin fuente de video'}</span>
                            </div>
                          )}
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
            {selected.type === 'gallery' && (
              <button
                type="button"
                disabled={!onUploadAsset || uploadingAsset}
                onClick={() => requestAssetUpload((url) => commit(updateBlock(normalized, selected.id, { items: [...(selected.items || []), url] })), selected.title)}
              >
                {uploadingAsset ? 'Subiendo imagen...' : 'Subir imagen a galeria'}
              </button>
            )}
            {selected.type === 'carousel' && (
              <>
                <label>Slides del carrusel<textarea value={(selected.items || []).join('\n')} onChange={(e) => commit(updateBlock(normalized, selected.id, { items: e.target.value.split('\n').filter(Boolean) }))} placeholder={'https://.../slide-1.jpg|Titulo 1|Texto 1\nhttps://.../slide-2.jpg|Titulo 2|Texto 2'} /></label>
                <button
                  type="button"
                  disabled={!onUploadAsset || uploadingAsset}
                  onClick={() => requestAssetUpload((url) => commit(updateBlock(normalized, selected.id, { items: [...(selected.items || []), `${url}|Nuevo slide|Describe este slide`] })), selected.title)}
                >
                  {uploadingAsset ? 'Subiendo imagen...' : 'Subir imagen como slide'}
                </button>
              </>
            )}
            {selected.type === 'image' && (
              <>
                <label>Imagen<input value={selected.image || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { image: e.target.value }))} /></label>
                <button
                  type="button"
                  disabled={!onUploadAsset || uploadingAsset}
                  onClick={() => requestAssetUpload((url) => commit(updateBlock(normalized, selected.id, { image: url })), selected.title)}
                >
                  {uploadingAsset ? 'Subiendo imagen...' : 'Subir imagen'}
                </button>
              </>
            )}
            {selected.type === 'table' && (
              <label>Filas de tabla<textarea value={(selected.items || []).join('\n')} onChange={(e) => commit(updateBlock(normalized, selected.id, { items: e.target.value.split('\n').filter(Boolean) }))} placeholder={'Encabezado 1|Encabezado 2|Encabezado 3\nFila 1 col 1|Fila 1 col 2|Fila 1 col 3'} /></label>
            )}
            {selected.type === 'pricing' && (
              <label>Tarjetas de precio<textarea value={(selected.items || []).join('\n')} onChange={(e) => commit(updateBlock(normalized, selected.id, { items: e.target.value.split('\n').filter(Boolean) }))} placeholder={'Starter|$19/mes|Feature 1,Feature 2,Feature 3\nGrowth|$49/mes|Feature A,Feature B,Feature C'} /></label>
            )}
            {selected.type === 'testimonials' && (
              <label>Testimonios<textarea value={(selected.items || []).join('\n')} onChange={(e) => commit(updateBlock(normalized, selected.id, { items: e.target.value.split('\n').filter(Boolean) }))} placeholder={'Ana Torres|CEO de Wellness|La plataforma nos ayudo a vender mas\nLuis Mejia|Founder|El editor es rapido y claro'} /></label>
            )}
            {selected.type === 'video' && (
              <>
                <label>URL del video<input value={selected.embedUrl || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { embedUrl: e.target.value }))} placeholder="https://www.youtube.com/watch?v=... o https://cdn.../video.mp4" /></label>
                <label>Poster / portada<input value={selected.image || ''} onChange={(e) => commit(updateBlock(normalized, selected.id, { image: e.target.value }))} placeholder="https://..." /></label>
                <button
                  type="button"
                  disabled={!onUploadAsset || uploadingAsset}
                  onClick={() => requestAssetUpload((url) => commit(updateBlock(normalized, selected.id, { image: url })), `${selected.title}-poster`)}
                >
                  {uploadingAsset ? 'Subiendo imagen...' : 'Subir poster'}
                </button>
              </>
            )}
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

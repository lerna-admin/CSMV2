import type { SiteBlock } from '../types/domain';

function escapeStyleText(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style');
}

function escapeScriptText(js: string): string {
  return js.replace(/<\/script/gi, '<\\/script');
}

function assetBaseFromUrl(sourceUrl: string): string {
  return new URL('.', new URL(sourceUrl, window.location.href)).href;
}

const externalHosts = [
  'cdnjs.cloudflare.com',
  'netdna.bootstrapcdn.com',
  'oss.maxcdn.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'polyfill.io',
  'maps.googleapis.com',
  'maps.gstatic.com',
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeTemplateHtml(html: string): string {
  const hostPattern = externalHosts.map(escapeRegExp).join('|');
  return html
    .replace(/(["'(=])https:(?!\/\/)/gi, '$1https://')
    .replace(/(["'(=])http:(?!\/\/)/gi, '$1http://')
    .replace(new RegExp(`(["'(=])(${hostPattern})`, 'gi'), '$1https://$2')
    .replace(new RegExp(`(["'(=])(?:https?:)?[^"'()\\s]*?/templates/[^"'()\\s]*/(${hostPattern})`, 'gi'), '$1https://$2');
}

export function cloneBlocksWithNewIds(blocks: SiteBlock[]): SiteBlock[] {
  const ids = new Map<string, string>();
  for (const block of blocks) ids.set(block.id, crypto.randomUUID());
  return blocks.map((block) => ({
    ...block,
    id: ids.get(block.id) || crypto.randomUUID(),
    parentId: block.parentId ? ids.get(block.parentId) || block.parentId : undefined,
  }));
}

export function injectBaseTag(html: string, sourceUrl: string): string {
  const normalizedHtml = normalizeTemplateHtml(html);
  const baseHref = assetBaseFromUrl(sourceUrl);
  const baseTag = `<base href="${baseHref}">`;
  if (/<base\s/i.test(normalizedHtml)) return normalizedHtml.replace(/<base[^>]*>/i, baseTag);
  if (/<head[^>]*>/i.test(normalizedHtml)) return normalizedHtml.replace(/<head[^>]*>/i, (match) => `${match}\n${baseTag}`);
  return `<!doctype html><html><head>${baseTag}</head><body>${normalizedHtml}</body></html>`;
}

export async function materializeTemplateBlocks(blocks: SiteBlock[]): Promise<SiteBlock[]> {
  const cloned = cloneBlocksWithNewIds(blocks);
  await Promise.all(cloned.map(async (block) => {
    if (block.type !== 'html' || block.html || !block.embedUrl) return;
    const response = await fetch(block.embedUrl, { cache: 'no-store' });
    const html = await response.text();
    block.sourceUrl = block.embedUrl;
    block.htmlBaseUrl = assetBaseFromUrl(block.embedUrl);
    block.html = injectBaseTag(html, block.embedUrl);
  }));
  return cloned;
}

export function composeFrameHtml(block: SiteBlock, editor = false): string | undefined {
  if (!block.html) return undefined;
  const styles = [
    block.htmlCss ? `<style data-csmv2-user-css>${escapeStyleText(block.htmlCss)}</style>` : '',
    editor ? `<style data-csmv2-editor-css>
      [data-csmv2-edit-id]{cursor:text}
      [data-csmv2-edit-id]:hover{outline:1px dashed rgba(0,110,220,.45);outline-offset:2px}
      .csmv2-node-selected{outline:3px solid #006edc!important;outline-offset:3px!important;background-color:rgba(0,110,220,.08)!important}
    </style>` : '',
  ].filter(Boolean).join('\n');
  const runtime = `window.csmv2RunAction=function(name,event,element){if(event){event.preventDefault();event.stopPropagation();}var fn=window[name];if(typeof fn==="function"){var result=fn.call(element||window,event,element);return result===undefined?false:result;}console.warn("CSMV2 action not found:",name);return false;};`;
  const scripts = !editor && block.htmlJs ? `<script data-csmv2-user-js>${runtime}\n${escapeScriptText(block.htmlJs)}</script>` : '';
  let next = normalizeTemplateHtml(block.html);
  if (styles) {
    next = /<\/head>/i.test(next) ? next.replace(/<\/head>/i, `${styles}\n</head>`) : `${styles}\n${next}`;
  }
  if (scripts) {
    next = /<\/body>/i.test(next) ? next.replace(/<\/body>/i, `${scripts}\n</body>`) : `${next}\n${scripts}`;
  }
  return next;
}

export function serializeFrameDocument(documentRef: Document): string {
  const clone = documentRef.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-csmv2-user-css], [data-csmv2-user-js], [data-csmv2-editor-css]').forEach((node) => node.remove());
  clone.querySelectorAll('[data-csmv2-edit-id]').forEach((node) => {
    const element = node as HTMLElement;
    element.removeAttribute('data-csmv2-edit-id');
    element.removeAttribute('contenteditable');
    element.classList.remove('csmv2-node-selected');
    if (!element.getAttribute('class')) element.removeAttribute('class');
  });
  return `<!doctype html>\n${clone.outerHTML}`;
}

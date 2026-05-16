import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { FormLead, SiteBlock, SiteTheme } from '../types/domain';
import { composeFrameHtml } from '../lib/htmlTemplates';

type Props = {
  blocks: SiteBlock[];
  siteSlug?: string;
  theme?: SiteTheme;
  onLead?: (lead: FormLead) => void;
  renderMode?: 'preview' | 'public';
};

function parseCssText(css?: string): CSSProperties | undefined {
  if (!css) return undefined;
  const entries = css
    .split(';')
    .map((rule) => rule.split(':').map((part) => part.trim()))
    .filter((rule) => rule.length >= 2 && rule[0]);
  return Object.fromEntries(entries.map(([key, ...value]) => [key, value.join(':')])) as CSSProperties;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitForWindowLoad(frame: HTMLIFrameElement): Promise<void> {
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win || doc.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, 8000);
    win.addEventListener('load', () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

function waitForReadyFlag(frame: HTMLIFrameElement): Promise<void> {
  const doc = frame.contentDocument;
  const win = frame.contentWindow as (Window & { __csmv2Ready?: boolean }) | null;
  if (!doc || !win) return Promise.resolve();
  if (win.__csmv2Ready || doc.documentElement.getAttribute('data-csmv2-ready') === 'true') return Promise.resolve();
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (win.__csmv2Ready || doc.documentElement.getAttribute('data-csmv2-ready') === 'true' || Date.now() - startedAt > 6500) {
        window.clearInterval(timer);
        resolve();
      }
    }, 80);
  });
}

function waitForFrameAssets(frame: HTMLIFrameElement): Promise<void> {
  const doc = frame.contentDocument;
  if (!doc) return Promise.resolve();
  const images = Array.from(doc.images || []).filter((img) => !img.complete);
  const imageWait = images.length
    ? Promise.race([
      Promise.all(images.map((img) => new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      }))),
      delay(4500),
    ])
    : Promise.resolve();
  const fontWait = doc.fonts?.ready.then(() => undefined).catch(() => undefined) || Promise.resolve();
  return Promise.all([imageWait, fontWait]).then(() => undefined);
}

async function waitForFrameReady(frame: HTMLIFrameElement): Promise<void> {
  await waitForWindowLoad(frame);
  await waitForReadyFlag(frame);
  await waitForFrameAssets(frame);
  await delay(140);
}

function stabilizeFrameRuntime(frame: HTMLIFrameElement): void {
  try {
    const win = frame.contentWindow as (Window & { jQuery?: unknown; $?: unknown }) | null;
    if (!win) return;
    win.dispatchEvent(new Event('resize'));
    win.dispatchEvent(new Event('scroll'));
    const maybeJquery = win.jQuery || win.$;
    if (typeof maybeJquery === 'function') {
      const jq = maybeJquery as (target: Window) => { trigger?: (eventName: string) => void };
      jq(win).trigger?.('resize');
      jq(win).trigger?.('scroll');
    }
  } catch {
    /* Template scripts should never break the host renderer. */
  }
}

function EmbeddedTemplateFrame({
  block,
  renderMode,
  onFrameLoad,
}: {
  block: SiteBlock;
  renderMode: 'preview' | 'public';
  onFrameLoad: (frame: HTMLIFrameElement) => void;
}) {
  const [ready, setReady] = useState(renderMode !== 'public');
  const mounted = useRef(true);
  const srcDoc = composeFrameHtml(block);

  useEffect(() => {
    mounted.current = true;
    setReady(renderMode !== 'public');
    return () => { mounted.current = false; };
  }, [block.id, block.html, block.embedUrl, renderMode]);

  async function handleLoad(frame: HTMLIFrameElement) {
    onFrameLoad(frame);
    if (renderMode === 'public') {
      await waitForFrameReady(frame);
      stabilizeFrameRuntime(frame);
      window.setTimeout(() => stabilizeFrameRuntime(frame), 250);
      window.setTimeout(() => stabilizeFrameRuntime(frame), 1000);
    }
    if (mounted.current) setReady(true);
  }

  return (
    <div className={`embedded-template-wrap ${renderMode === 'public' ? 'embedded-template-wrap-public' : ''}`}>
      <iframe
        title={block.title || 'Plantilla HTML'}
        className={`embedded-template-frame ${renderMode === 'public' ? 'embedded-template-frame-public' : ''} ${ready ? 'embedded-template-frame-ready' : 'embedded-template-frame-loading'}`}
        src={srcDoc ? undefined : block.embedUrl}
        srcDoc={srcDoc}
        scrolling={renderMode === 'public' ? 'auto' : 'no'}
        onLoad={(event) => { void handleLoad(event.currentTarget); }}
      />
      {!ready && renderMode === 'public' && <div className="site-frame-loader">Cargando sitio y scripts...</div>}
    </div>
  );
}

export default function SiteRenderer({ blocks, siteSlug = 'preview', theme, onLead, renderMode = 'preview' }: Props) {
  const [sent, setSent] = useState(false);
  const hasTree = useMemo(() => blocks.some((b) => b.nodeType || b.type === 'section'), [blocks]);
  const hasEmbeddedTemplate = useMemo(() => blocks.some((b) => b.type === 'html' && (b.embedUrl || b.html)), [blocks]);
  const sections = useMemo(() => (hasTree ? blocks.filter((b) => b.nodeType === 'section' || b.type === 'section') : []), [blocks, hasTree]);
  const looseBlocks = useMemo(() => (hasTree ? [] : blocks), [blocks, hasTree]);
  const pages = useMemo(
    () => Array.from(new Map(sections.map((s) => [s.pageId || 'home', s.pageName || 'Home'])).entries()).map(([id, name]) => ({ id, name })),
    [sections],
  );
  const [activePage, setActivePage] = useState(pages[0]?.id || 'home');

  useEffect(() => {
    const scripts = blocks.map((b) => b.customJs).filter(Boolean);
    for (const code of scripts) {
      try { new Function(String(code))(); } catch { /* Invalid user snippets must not crash preview. */ }
    }
  }, [blocks]);

  function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lead = {
      id: crypto.randomUUID(),
      siteSlug,
      name: String(form.get('name') || ''),
      email: String(form.get('email') || ''),
      message: String(form.get('message') || ''),
      createdAt: new Date().toISOString(),
    };
    onLead?.(lead);
    setSent(true);
    event.currentTarget.reset();
  }

  function measureFrameDocument(doc: Document) {
    const root = doc.documentElement;
    const body = doc.body;
    const childBottom = body
      ? Array.from(body.children).reduce((max, child) => Math.max(max, (child as HTMLElement).getBoundingClientRect().bottom), 0)
      : 0;
    return Math.ceil(Math.max(
      body?.scrollHeight || 0,
      root?.scrollHeight || 0,
      body?.offsetHeight || 0,
      root?.offsetHeight || 0,
      root?.getBoundingClientRect().height || 0,
      childBottom,
      720,
    ));
  }

  function resizeFrame(frame: HTMLIFrameElement) {
    const allowInternalScroll = renderMode === 'public';
    frame.setAttribute('scrolling', allowInternalScroll ? 'auto' : 'no');
    if (allowInternalScroll) {
      frame.style.height = '100dvh';
      try {
        const doc = frame.contentDocument;
        if (doc?.documentElement) {
          doc.documentElement.style.overflowX = 'hidden';
          doc.documentElement.style.overflowY = 'auto';
          doc.documentElement.style.minHeight = '100%';
        }
        if (doc?.body) {
          doc.body.style.overflowX = 'hidden';
          doc.body.style.overflowY = 'auto';
          doc.body.style.minHeight = '100%';
        }
      } catch {
        /* Cross-origin frames still keep iframe-level scrolling. */
      }
      return;
    }
    const update = () => {
      try {
        const doc = frame.contentDocument;
        if (!doc) return;
        if (doc.documentElement) {
          doc.documentElement.style.overflowX = 'hidden';
          doc.documentElement.style.overflowY = allowInternalScroll ? 'auto' : 'visible';
        }
        if (doc.body) {
          doc.body.style.overflowX = 'hidden';
          doc.body.style.overflowY = allowInternalScroll ? 'auto' : 'visible';
        }
        const height = measureFrameDocument(doc);
        frame.style.height = `${height}px`;
      } catch {
        frame.style.height = allowInternalScroll ? '100dvh' : '4200px';
      }
    };
    update();
    try {
      const doc = frame.contentDocument;
      if (doc?.documentElement) new ResizeObserver(update).observe(doc.documentElement);
      if (doc?.body) {
        new ResizeObserver(update).observe(doc.body);
        new MutationObserver(update).observe(doc.body, { attributes: true, childList: true, subtree: true });
      }
      doc?.querySelectorAll('img').forEach((img) => img.addEventListener('load', update, { once: true }));
      void doc?.fonts?.ready.then(update);
    } catch {
      /* Cross-origin frames keep their own height fallback. */
    }
    window.setTimeout(update, 300);
    window.setTimeout(update, 1800);
    window.setTimeout(update, 4200);
  }

  function renderEmbeddedTemplate(block: SiteBlock) {
    return (
      <EmbeddedTemplateFrame
        block={block}
        renderMode={renderMode}
        onFrameLoad={resizeFrame}
      />
    );
  }

  function renderBlock(block: SiteBlock) {
    if (block.type === 'html' && (block.embedUrl || block.html)) {
      return (
        <article key={block.id} className={`b-html ${block.customClass || ''}`} style={parseCssText(block.customCss)}>
          {renderEmbeddedTemplate(block)}
        </article>
      );
    }

    return (
      <article key={block.id} className={`b-${block.type} ${block.customClass || ''}`} style={parseCssText(block.customCss)}>
        <h3>{block.title}</h3>
        <p>{block.content}</p>
        {block.type === 'navbar' && <nav className="nav-inline">{(block.items || []).map((item) => <a key={item} href="#">{item}</a>)}</nav>}
        {block.type === 'gallery' && <div className="gallery-grid">{(block.items || []).map((img) => <img key={img} src={img} alt="gallery" />)}</div>}
        {block.type === 'faq' && <div>{(block.items || []).map((qa) => <p key={qa}>{qa}</p>)}</div>}
        {block.image && <img src={block.image} alt={block.title} />}
        {block.buttonText && <a href={block.buttonUrl || '#'}>{block.buttonText}</a>}
        {block.type === 'contactForm' && (
          <form className="lead-form" onSubmit={submitLead}>
            <input name="name" placeholder="Nombre" required />
            <input name="email" placeholder="Email" type="email" required />
            <textarea name="message" placeholder="Mensaje" required />
            <button type="submit">Enviar</button>
            {sent && <small>Mensaje enviado.</small>}
          </form>
        )}
      </article>
    );
  }

  return (
    <main
      className={`public-site ${hasEmbeddedTemplate ? 'public-site-embedded' : ''} ${renderMode === 'public' ? 'public-site-rendered' : ''}`}
      style={theme ? { background: theme.background, color: theme.text, fontFamily: theme.font } : undefined}
    >
      {pages.length > 1 && <nav className="nav-inline">{pages.map((p) => <button key={p.id} type="button" onClick={() => setActivePage(p.id)}>{p.name}</button>)}</nav>}
      {sections.map((section) => {
        const visible = (section.pageId || 'home') === activePage;
        const sectionStyle = { ...parseCssText(section.customCss), display: visible ? 'block' : 'none' };
        if (section.type === 'html' && (section.embedUrl || section.html)) {
          return (
            <section key={section.id} className={`b-section b-html-shell ${section.customClass || ''}`} style={sectionStyle}>
              {renderEmbeddedTemplate(section)}
            </section>
          );
        }

        return (
          <section
            key={section.id}
            className={`b-section ${section.customClass || ''}`}
            style={sectionStyle}
          >
            <h2>{section.title}</h2>
            <p>{section.content}</p>
            {blocks.filter((b) => b.parentId === section.id).map(renderBlock)}
          </section>
        );
      })}
      {looseBlocks.map(renderBlock)}
    </main>
  );
}

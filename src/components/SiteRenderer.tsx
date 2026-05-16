import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { FormLead, SiteBlock, SiteTheme } from '../types/domain';
import { composeFrameHtml } from '../lib/htmlTemplates';
import { resolveUploadedAssetUrl } from '../lib/storage';

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

function toVideoEmbedUrl(source?: string): string {
  if (!source) return '';
  const value = source.trim();
  const youtubeWatch = value.match(/youtube\.com\/watch\?v=([^&]+)/i)?.[1];
  if (youtubeWatch) return `https://www.youtube.com/embed/${youtubeWatch}`;
  const youtubeShort = value.match(/youtu\.be\/([^?&]+)/i)?.[1];
  if (youtubeShort) return `https://www.youtube.com/embed/${youtubeShort}`;
  const vimeo = value.match(/vimeo\.com\/(\d+)/i)?.[1];
  if (vimeo) return `https://player.vimeo.com/video/${vimeo}`;
  return value;
}

function addIframeQuery(url: string, params: Record<string, string>): string {
  try {
    const next = new URL(url);
    Object.entries(params).forEach(([key, value]) => next.searchParams.set(key, value));
    return next.toString();
  } catch {
    return url;
  }
}

function isDirectVideoFile(source?: string): boolean {
  return !!source && /\.(mp4|webm|ogg)(\?.*)?$/i.test(source.trim());
}

function CarouselBlock({ block }: { block: SiteBlock }) {
  const slides = parseCarouselSlides(block.items);
  const settings = {
    autoplay: block.settings?.autoplay ?? false,
    intervalMs: Math.max(1000, Number(block.settings?.intervalMs || 5000)),
    transition: block.settings?.transition || 'slide',
    showArrows: block.settings?.showArrows ?? true,
    showDots: block.settings?.showDots ?? true,
    prevLabel: block.settings?.prevLabel || 'Anterior',
    nextLabel: block.settings?.nextLabel || 'Siguiente',
    imageFit: block.settings?.imageFit || 'cover',
    overlayOpacity: block.settings?.overlayOpacity ?? 0.55,
  };
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [block.id, block.items]);

  useEffect(() => {
    if (!settings.autoplay || slides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, settings.intervalMs);
    return () => window.clearInterval(timer);
  }, [settings.autoplay, settings.intervalMs, slides.length]);

  if (!slides.length) return null;
  const slide = slides[activeIndex] || slides[0];

  return (
    <div className={`public-carousel public-carousel-${settings.transition}`}>
      <div className="public-carousel-stage">
        {slide.image && <img src={resolveUploadedAssetUrl(slide.image)} alt={slide.title || block.title} style={{ objectFit: settings.imageFit }} />}
        <div className="public-carousel-copy" style={{ background: `linear-gradient(180deg, transparent 0%, rgba(15, 23, 42, ${settings.overlayOpacity}) 100%)` }}>
          <strong>{slide.title || block.title}</strong>
          {slide.text && <p>{slide.text}</p>}
        </div>
      </div>
      {slides.length > 1 && settings.showArrows && (
        <div className="public-carousel-nav">
          <button type="button" onClick={() => setActiveIndex((current) => (current - 1 + slides.length) % slides.length)}>{settings.prevLabel}</button>
          <span>{activeIndex + 1} / {slides.length}</span>
          <button type="button" onClick={() => setActiveIndex((current) => (current + 1) % slides.length)}>{settings.nextLabel}</button>
        </div>
      )}
      {slides.length > 1 && settings.showDots && (
        <div className="public-carousel-dots">
          {slides.map((_, index) => (
            <button
              key={`${block.id}-dot-${index}`}
              type="button"
              className={index === activeIndex ? 'active' : ''}
              aria-label={`Ir al slide ${index + 1}`}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoBlock({ block }: { block: SiteBlock }) {
  const settings = {
    autoplay: block.settings?.autoplay ?? false,
    muted: block.settings?.muted ?? false,
    loop: block.settings?.loop ?? false,
    showControls: block.settings?.showControls ?? true,
    aspectRatio: block.settings?.aspectRatio || '16 / 9',
  };
  const source = toVideoEmbedUrl(block.embedUrl);
  if (!source) return null;

  if (isDirectVideoFile(source)) {
    return (
      <div className="public-video-wrap">
        <video
          className="public-video"
          controls={settings.showControls}
          autoPlay={settings.autoplay}
          muted={settings.muted}
          loop={settings.loop}
          playsInline
          poster={block.image ? resolveUploadedAssetUrl(block.image) : undefined}
          style={{ aspectRatio: settings.aspectRatio }}
        >
          <source src={resolveUploadedAssetUrl(source)} />
        </video>
      </div>
    );
  }

  const embedSource = settings.autoplay || settings.muted
    ? addIframeQuery(source, {
      autoplay: settings.autoplay ? '1' : '0',
      mute: settings.muted ? '1' : '0',
      muted: settings.muted ? '1' : '0',
      loop: settings.loop ? '1' : '0',
      controls: settings.showControls ? '1' : '0',
      playlist: settings.loop && /youtube\.com\/embed\//.test(source) ? source.split('/embed/')[1]?.split('?')[0] || '' : '',
    })
    : source;

  return (
    <div className="public-video-wrap">
      <iframe
        className="public-video"
        title={block.title}
        src={embedSource}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ aspectRatio: settings.aspectRatio }}
      />
    </div>
  );
}

function PricingBlock({ block }: { block: SiteBlock }) {
  const cards = parsePricingCards(block.items);
  const settings = {
    pricingColumns: Math.min(4, Math.max(1, Number(block.settings?.pricingColumns || 2))),
    highlightFeatured: block.settings?.highlightFeatured ?? true,
    featuredIndex: Math.max(0, Number(block.settings?.featuredIndex || 1)),
    priceAccent: block.settings?.priceAccent || '#0f172a',
    cardStyle: block.settings?.cardStyle || 'solid',
  };
  if (!cards.length) return null;
  return (
    <div className={`public-pricing-grid public-card-style-${settings.cardStyle}`} style={{ gridTemplateColumns: `repeat(${settings.pricingColumns}, minmax(220px, 1fr))` }}>
      {cards.map((card, index) => (
        <article key={`${block.id}-pricing-${index}`} className={`public-pricing-card ${settings.highlightFeatured && index === settings.featuredIndex ? 'featured' : ''}`}>
          <strong>{card.name || `Plan ${index + 1}`}</strong>
          <span style={{ color: settings.priceAccent }}>{card.price}</span>
          <ul>
            {card.features.map((feature) => <li key={`${block.id}-pricing-${index}-${feature}`}>{feature}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

function TestimonialsBlock({ block }: { block: SiteBlock }) {
  const items = parseTestimonials(block.items);
  const settings = {
    showQuoteMarks: block.settings?.showQuoteMarks ?? true,
    testimonialColumns: Math.min(4, Math.max(1, Number(block.settings?.testimonialColumns || 2))),
    cardStyle: block.settings?.cardStyle || 'soft',
  };
  if (!items.length) return null;
  return (
    <div className={`public-testimonials-grid public-card-style-${settings.cardStyle}`} style={{ gridTemplateColumns: `repeat(${settings.testimonialColumns}, minmax(220px, 1fr))` }}>
      {items.map((item, index) => (
        <article key={`${block.id}-testimonial-${index}`} className="public-testimonial-card">
          <p>{settings.showQuoteMarks ? `“${item.quote}”` : item.quote}</p>
          <strong>{item.author || `Cliente ${index + 1}`}</strong>
          {item.role && <span>{item.role}</span>}
        </article>
      ))}
    </div>
  );
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
        {block.type === 'gallery' && (
          <div
            className="gallery-grid"
            style={{
              gridTemplateColumns: `repeat(${Math.min(6, Math.max(1, Number(block.settings?.galleryColumns || 3)))}, minmax(0, 1fr))`,
              gap: `${Math.max(0, Number(block.settings?.gap || 12))}px`,
            }}
          >
            {(block.items || []).map((img) => <img key={img} src={resolveUploadedAssetUrl(img)} alt="gallery" style={{ objectFit: block.settings?.imageFit || 'cover' }} />)}
          </div>
        )}
        {block.type === 'faq' && <div>{(block.items || []).map((qa) => <p key={qa}>{qa}</p>)}</div>}
        {block.type === 'carousel' && <CarouselBlock block={block} />}
        {block.type === 'table' && (
          <div className="public-table-wrap">
            <table className={`public-table ${block.settings?.striped ? 'public-table-striped' : ''} ${block.settings?.compact ? 'public-table-compact' : ''}`}>
              <tbody>
                {parseTableRows(block.items).map((row, rowIndex) => (
                  <tr key={`${block.id}-row-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      rowIndex === 0
                        ? <th key={`${block.id}-cell-${rowIndex}-${cellIndex}`} style={{ background: block.settings?.headerBackground || '#eef6ff', textAlign: block.settings?.tableAlign || 'left' }}>{cell}</th>
                        : <td key={`${block.id}-cell-${rowIndex}-${cellIndex}`} style={{ textAlign: block.settings?.tableAlign || 'left' }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {block.type === 'video' && <VideoBlock block={block} />}
        {block.type === 'pricing' && <PricingBlock block={block} />}
        {block.type === 'testimonials' && <TestimonialsBlock block={block} />}
        {block.image && block.type !== 'video' && (
          block.settings?.linkUrl ? (
            <a href={block.settings.linkUrl} target={block.settings.openInNewTab ? '_blank' : undefined} rel={block.settings.openInNewTab ? 'noreferrer noopener' : undefined}>
              <img src={resolveUploadedAssetUrl(block.image)} alt={block.title} style={{ objectFit: block.settings?.imageFit || 'cover' }} />
            </a>
          ) : (
            <img src={resolveUploadedAssetUrl(block.image)} alt={block.title} style={{ objectFit: block.settings?.imageFit || 'cover' }} />
          )
        )}
        {block.buttonText && <a href={block.settings?.linkUrl || block.buttonUrl || '#'} target={block.settings?.openInNewTab ? '_blank' : undefined} rel={block.settings?.openInNewTab ? 'noreferrer noopener' : undefined}>{block.buttonText}</a>}
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

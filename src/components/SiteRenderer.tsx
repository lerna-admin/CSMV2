import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react';
import type { FormLead, SiteBlock, SiteTheme } from '../types/domain';

type Props = {
  blocks: SiteBlock[];
  siteSlug?: string;
  theme?: SiteTheme;
  onLead?: (lead: FormLead) => void;
};

function parseCssText(css?: string): CSSProperties | undefined {
  if (!css) return undefined;
  const entries = css
    .split(';')
    .map((rule) => rule.split(':').map((part) => part.trim()))
    .filter((rule) => rule.length >= 2 && rule[0]);
  return Object.fromEntries(entries.map(([key, ...value]) => [key, value.join(':')])) as CSSProperties;
}

export default function SiteRenderer({ blocks, siteSlug = 'preview', theme, onLead }: Props) {
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

  function resizeFrame(frame: HTMLIFrameElement) {
    const update = () => {
      try {
        const doc = frame.contentDocument;
        const height = Math.max(
          doc?.body?.scrollHeight || 0,
          doc?.documentElement?.scrollHeight || 0,
          720,
        );
        frame.style.height = `${height}px`;
      } catch {
        frame.style.height = '4200px';
      }
    };
    update();
    window.setTimeout(update, 300);
    window.setTimeout(update, 1800);
  }

  function renderEmbeddedTemplate(block: SiteBlock) {
    return (
      <iframe
        title={block.title || 'Plantilla HTML'}
        className="embedded-template-frame"
        src={block.embedUrl}
        srcDoc={block.embedUrl ? undefined : block.html}
        onLoad={(event) => resizeFrame(event.currentTarget)}
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
      className={`public-site ${hasEmbeddedTemplate ? 'public-site-embedded' : ''}`}
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

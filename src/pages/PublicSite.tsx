import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProjects, issueUrl, pushLead } from '../lib/storage';

export default function PublicSite() {
  const { slug = '' } = useParams();
  const [sent, setSent] = useState(false);
  const site = useMemo(() => getProjects().find((p) => p.slug === slug && p.status === 'published') || null, [slug]);

  if (!site) return <main className="public-site"><h1>Sitio no disponible</h1></main>;
  const hasTree = site.blocks.some((b) => b.nodeType || b.type === 'section');
  const sections = hasTree ? site.blocks.filter((b) => b.nodeType === 'section' || b.type === 'section') : [];
  const looseBlocks = hasTree ? [] : site.blocks;
  const pages = Array.from(new Map(sections.map((s) => [s.pageId || 'home', s.pageName || 'Home'])).entries()).map(([id, name]) => ({ id, name }));
  const [activePage, setActivePage] = useState(pages[0]?.id || 'home');

  useEffect(() => {
    const scripts = site.blocks.map((b) => b.customJs).filter(Boolean);
    for (const code of scripts) {
      try { new Function(String(code))(); } catch { /* ignore invalid user snippets */ }
    }
  }, [site.blocks]);

  function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!site) return;
    const form = new FormData(event.currentTarget);
    const lead = {
      id: crypto.randomUUID(),
      siteSlug: site.slug,
      name: String(form.get('name') || ''),
      email: String(form.get('email') || ''),
      message: String(form.get('message') || ''),
      createdAt: new Date().toISOString(),
    };
    pushLead(lead);
    window.open(issueUrl('submit-lead', lead), '_blank', 'noopener,noreferrer');
    setSent(true);
    event.currentTarget.reset();
  }

  return (
    <main className="public-site">
      {pages.length > 1 && <nav className="nav-inline">{pages.map((p) => <button key={p.id} type="button" onClick={() => setActivePage(p.id)}>{p.name}</button>)}</nav>}
      {sections.map((section) => (
        <section key={section.id} className={`b-section ${section.customClass || ''}`} style={{ display: (section.pageId || 'home') === activePage ? 'block' : 'none' }}>
          <h2>{section.title}</h2>
          <p>{section.content}</p>
          {(site.blocks.filter((b) => b.parentId === section.id)).map((block) => (
            <article key={block.id} className={`b-${block.type} ${block.customClass || ''}`}>
              {block.customCss && <style>{block.customCss}</style>}
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
          ))}
        </section>
      ))}

      {looseBlocks.map((block) => (
        <section key={block.id} className={`b-${block.type}`}>
          <h2>{block.title}</h2>
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
        </section>
      ))}
    </main>
  );
}

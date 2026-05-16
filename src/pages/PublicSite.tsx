import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getProjects } from '../lib/storage';

export default function PublicSite() {
  const { slug = '' } = useParams();
  const site = useMemo(() => getProjects().find((p) => p.slug === slug && p.status === 'published') || null, [slug]);

  if (!site) {
    return <main className="public-site"><h1>Sitio no disponible</h1></main>;
  }

  return (
    <main className="public-site">
      {site.blocks.map((block) => (
        <section key={block.id} className={`b-${block.type}`}>
          <h2>{block.title}</h2>
          <p>{block.content}</p>
          {block.image && <img src={block.image} alt={block.title} />}
          {block.buttonText && <a href={block.buttonUrl || '#'}>{block.buttonText}</a>}
        </section>
      ))}
    </main>
  );
}

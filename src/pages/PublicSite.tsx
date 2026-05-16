import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SiteRenderer from '../components/SiteRenderer';
import { enqueueCommand, getProjects, pushLead } from '../lib/storage';
import type { SiteProject } from '../types/domain';

export default function PublicSite() {
  const { slug = '' } = useParams();
  const [site, setSite] = useState<SiteProject | null>(() => getProjects().find((p) => p.slug === slug && p.status === 'published') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const localSite = getProjects().find((p) => p.slug === slug && p.status === 'published') || null;
    setSite(localSite);
    setLoading(true);
    fetch(`${import.meta.env.BASE_URL}data/sites/${encodeURIComponent(slug)}.json?ts=${Date.now()}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((remoteSite: SiteProject | null) => {
        if (active && remoteSite?.status === 'published') setSite(remoteSite);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug]);

  if (!site && loading) return <main className="public-site"><h1>Cargando sitio...</h1></main>;
  if (!site) return <main className="public-site"><h1>Sitio no disponible</h1></main>;

  return (
    <SiteRenderer
      blocks={site.blocks}
      siteSlug={site.slug}
      theme={site.theme}
      onLead={(lead) => {
        pushLead(lead);
        enqueueCommand('submit-lead', lead);
      }}
    />
  );
}

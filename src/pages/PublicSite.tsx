import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SiteRenderer from '../components/SiteRenderer';
import { enqueueCommand, getProjects, pushLead } from '../lib/storage';
import type { SiteProject } from '../types/domain';

type SitesIndex = {
  files?: string[];
};

export default function PublicSite() {
  const { slug = '' } = useParams();
  const [site, setSite] = useState<SiteProject | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setSite(null);
    setLoading(true);

    async function loadRemoteSite() {
      const indexResponse = await fetch(`${import.meta.env.BASE_URL}data/sites/index.json?ts=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
      if (!indexResponse?.ok) return null;

      const index = await indexResponse.json() as SitesIndex;
      const fileName = `${slug}.json`;
      if (!index.files?.includes(fileName)) return null;

      const siteResponse = await fetch(`${import.meta.env.BASE_URL}data/sites/${encodeURIComponent(slug)}.json?ts=${Date.now()}`, { cache: 'no-store' }).catch(() => null);
      if (!siteResponse?.ok) return null;
      return await siteResponse.json() as SiteProject;
    }

    void loadRemoteSite()
      .then((remoteSite) => {
        if (!active) return;
        if (remoteSite?.status === 'published') {
          setSite(remoteSite);
          return;
        }
        const localSite = getProjects().find((p) => p.slug === slug && p.status === 'published') || null;
        setSite(localSite);
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
      renderMode="public"
      onLead={(lead) => {
        pushLead(lead);
        enqueueCommand('submit-lead', lead);
      }}
    />
  );
}

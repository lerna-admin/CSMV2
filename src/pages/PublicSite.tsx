import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import SiteRenderer from '../components/SiteRenderer';
import { enqueueCommand, getProjects, pushLead } from '../lib/storage';

export default function PublicSite() {
  const { slug = '' } = useParams();
  const site = useMemo(() => getProjects().find((p) => p.slug === slug && p.status === 'published') || null, [slug]);

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

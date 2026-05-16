export type Role = 'admin' | 'agente' | 'usuario';

export type User = {
  email: string;
  name: string;
  role: Role;
  passwordEncrypted: string;
  createdAt: string;
};

export type BlockType = 'hero' | 'text' | 'image' | 'cta' | 'features' | 'navbar' | 'gallery' | 'faq' | 'contactForm';

export type SiteBlock = {
  id: string;
  type: BlockType;
  title: string;
  content: string;
  image?: string;
  buttonText?: string;
  buttonUrl?: string;
  items?: string[];
};

export type SeoConfig = {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
};

export type SiteVersion = {
  id: string;
  createdAt: string;
  label: string;
  blocks: SiteBlock[];
  seo: SeoConfig;
};

export type SiteTemplate = {
  id: string;
  ownerEmail: string;
  ownerRole: Role;
  name: string;
  createdAt: string;
  blocks: SiteBlock[];
  publicTemplate: boolean;
};

export type FormLead = {
  id: string;
  siteSlug: string;
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

export type SiteProject = {
  id: string;
  ownerEmail: string;
  slug: string;
  title: string;
  description: string;
  status: 'draft' | 'published';
  templateId?: string;
  updatedAt: string;
  blocks: SiteBlock[];
  seo: SeoConfig;
  versions: SiteVersion[];
  publishTarget: 'staging' | 'production';
};

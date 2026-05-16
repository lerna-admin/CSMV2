export type Role = 'admin' | 'agente' | 'usuario';

export type User = {
  email: string;
  name: string;
  role: Role;
  password: string;
  createdAt: string;
};

export type BlockType = 'hero' | 'text' | 'image' | 'cta' | 'features';

export type SiteBlock = {
  id: string;
  type: BlockType;
  title: string;
  content: string;
  image?: string;
  buttonText?: string;
  buttonUrl?: string;
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
};

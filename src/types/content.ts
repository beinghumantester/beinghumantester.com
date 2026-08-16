export interface Bio {
    name: string;
    avatar: string;
    shortBio?: string;
    institution?: string;
}

export interface CVItem {
  institution: string;
  period: string;
  description?: string;
}

export interface EducationItem extends CVItem {
  degree: string;
  thesis?: string;
}

export interface ExperienceItem extends CVItem {
  role: string;
  highlights?: string[];
}

export interface SocialNetworkItem {
  network: string;
  username: string;
}

export interface CertificateItem {
  name: string;
  date?: string;
  issuer?: string;
}

export interface SkillItem {
  name: string;
  level?: string;
  keywords?: string[];
}

export interface CV {
  name: string;
  title: string;
  label?: string;
  email?: string;
  location?: string;
  image?: string;
  summary?: string;
  social_networks?: SocialNetworkItem[];
  experience: ExperienceItem[];
  education: EducationItem[];
  certificates?: CertificateItem[];
  skills?: SkillItem[];
}

export interface BasePage {
  title: string;
  description?: string;
  tags: string[];
}

export interface Blog extends BasePage {
  date: string;
  author?: string;
}

export interface Project extends BasePage {
  date: string;
  external_url?: string;
}

export interface Publication extends BasePage {
  date: string;
  author?: string;
  journal?: string;
  external_url?: string;
}

export interface Talk extends BasePage {
  date: string;
  event?: string;
  external_url?: string;
}

export interface Teaching extends BasePage {
  institution?: string;
  external_url?: string;
}
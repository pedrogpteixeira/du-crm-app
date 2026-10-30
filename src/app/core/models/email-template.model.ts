export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  active: boolean;
  shared: boolean;
  ownerId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface EmailTemplateDraft {
  name: string;
  subject: string;
  body: string;
  active: boolean;
  shared: false;
}

export interface EmailTemplatePage {
  items: EmailTemplate[];
  offset: number;
  limit: number;
  total: number | null;
  hasMore: boolean;
}

import type { ClientContractProvider } from '../services/client';
import type { EmailAddress } from './email.model';

export type EmailRelationEntityType = 'contract' | 'ticket';

export interface EmailCrmRelation {
  id: string;
  accountId: string;
  messageId: string;
  entityType: EmailRelationEntityType;
  entityId: string;
  provider: ClientContractProvider | null;
  createdAt: string | null;
}

export interface CreateEmailCrmRelationPayload {
  accountId: string;
  messageId: string;
  entityType: EmailRelationEntityType;
  entityId: string;
  provider?: ClientContractProvider;
}

export interface EmailContractSearchResult {
  entityType: 'contract';
  entityId: string;
  provider: ClientContractProvider;
  title: string;
  nif: string | null;
  estado: string | null;
  tipoProduto: string | null;
  updatedAt: string | null;
}

export interface EmailTicketSearchResult {
  entityType: 'ticket';
  entityId: string;
  title: string;
  tipo: string | null;
  estado: string | null;
  prioridade: string | null;
  contractId: string | null;
  companyId: string | null;
  updatedAt: string | null;
}

export type EmailEntitySearchResult = EmailContractSearchResult | EmailTicketSearchResult;

export interface RelatedEmailMessage {
  relationId: string;
  accountId: string;
  messageId: string;
  subject: string;
  from: EmailAddress | null;
  to: EmailAddress[];
  preview: string;
  date: string | null;
  hasAttachments: boolean;
}

export interface RelatedEmailPage {
  items: RelatedEmailMessage[];
  offset: number;
  limit: number;
  total: number | null;
  hasMore: boolean;
}

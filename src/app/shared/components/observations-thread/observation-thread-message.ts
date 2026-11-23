export interface ObservationThreadMessage {
  id: string;
  authorId: string | null;
  authorName: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  deleted?: boolean;
}

export interface ObservationThreadEditRequest {
  id: string;
  content: string;
}

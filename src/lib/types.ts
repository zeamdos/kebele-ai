export type Locale = "am" | "en";

export type DocumentKind =
  | "national_id"
  | "residence_certificate"
  | "kebele_form"
  | "kebele_letter"
  | "birth_certificate"
  | "unknown";

export type FormTemplateId =
  | "id_renewal"
  | "residence_certificate"
  | "birth_certificate_request"
  | "name_correction"
  | "marriage_certificate_request";

export type PaymentPurpose = "form_fill" | "errand_escrow";
export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "released";

export type ErrandStatus =
  | "posted"
  | "accepted"
  | "in_progress"
  | "done_pending_confirm"
  | "completed"
  | "cancelled";

export interface UserProfile {
  id: string;
  phone: string;
  displayName: string;
  role: "citizen" | "runner" | "admin";
  createdAt: string;
}

export interface KnowledgeChunk {
  id: string;
  serviceId: string;
  title: string;
  titleAm: string;
  body: string;
  bodyAm: string;
  tags: string[];
}

export interface AssistantTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  audioUrl?: string;
  sources?: Array<{ chunkId: string; titleAm: string }>;
  createdAt: string;
}

export interface DocumentReading {
  id: string;
  userId: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  ocrText: string;
  correctedText?: string;
  documentKind: DocumentKind;
  summaryAm: string;
  actionableFlags: string[];
  extractedFields: Record<string, string>;
  createdAt: string;
}

export interface FormFieldDef {
  key: string;
  labelAm: string;
  labelEn: string;
  helpAm: string;
  type: "text" | "date" | "phone" | "select" | "textarea";
  required: boolean;
  options?: Array<{ value: string; labelAm: string }>;
  autofillFrom?: string;
}

export interface FormTemplate {
  id: FormTemplateId;
  titleAm: string;
  titleEn: string;
  descriptionAm: string;
  kebeleOfficeHintAm: string;
  priceBirr: number;
  fields: FormFieldDef[];
}

export interface FormFillSession {
  id: string;
  userId: string;
  templateId: FormTemplateId;
  answers: Record<string, string>;
  currentFieldIndex: number;
  sourceDocumentId?: string;
  paymentId?: string;
  pdfStoragePath?: string;
  status: "draft" | "ready" | "paid" | "rendered";
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  purpose: PaymentPurpose;
  amountBirr: number;
  currency: string;
  status: PaymentStatus;
  providerRef: string;
  checkoutUrl?: string;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ErrandTask {
  id: string;
  reference: string;
  userId: string;
  runnerId?: string;
  title: string;
  description: string;
  kebeleOffice: string;
  priceBirr: number;
  status: ErrandStatus;
  documentIds: string[];
  formSessionId?: string;
  paymentId?: string;
  contactPhone: string;
  whatsappGroupHint?: string;
  completionPhotoPath?: string;
  completionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunnerProfile {
  id: string;
  userId: string;
  displayName: string;
  phone: string;
  kebeles: string[];
  vetted: boolean;
  active: boolean;
}

export interface StoredFile {
  path: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface DbSnapshot {
  users: UserProfile[];
  documents: DocumentReading[];
  formSessions: FormFillSession[];
  payments: PaymentRecord[];
  errands: ErrandTask[];
  runners: RunnerProfile[];
}

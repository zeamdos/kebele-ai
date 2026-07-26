import type {
  DbSnapshot,
  DocumentReading,
  ErrandTask,
  FormFillSession,
  PaymentRecord,
  RunnerProfile,
  UserProfile,
} from "@/lib/types";

export interface Repository {
  ensureSeed(): Promise<void>;

  getUser(id: string): Promise<UserProfile | undefined>;
  getUserByPhone(phone: string): Promise<UserProfile | undefined>;
  upsertUser(user: UserProfile): Promise<UserProfile>;

  createDocument(doc: DocumentReading): Promise<DocumentReading>;
  getDocument(id: string): Promise<DocumentReading | undefined>;
  updateDocument(
    id: string,
    patch: Partial<DocumentReading>,
  ): Promise<DocumentReading>;
  listDocuments(userId: string): Promise<DocumentReading[]>;

  createFormSession(session: FormFillSession): Promise<FormFillSession>;
  getFormSession(id: string): Promise<FormFillSession | undefined>;
  updateFormSession(
    id: string,
    patch: Partial<FormFillSession>,
  ): Promise<FormFillSession>;
  listFormSessions(userId: string): Promise<FormFillSession[]>;

  createPayment(payment: PaymentRecord): Promise<PaymentRecord>;
  getPayment(id: string): Promise<PaymentRecord | undefined>;
  getPaymentByProviderRef(ref: string): Promise<PaymentRecord | undefined>;
  updatePayment(
    id: string,
    patch: Partial<PaymentRecord>,
  ): Promise<PaymentRecord>;

  createErrand(task: ErrandTask): Promise<ErrandTask>;
  getErrand(id: string): Promise<ErrandTask | undefined>;
  updateErrand(id: string, patch: Partial<ErrandTask>): Promise<ErrandTask>;
  listErrands(filter?: {
    userId?: string;
    runnerId?: string;
    status?: ErrandTask["status"];
  }): Promise<ErrandTask[]>;

  listRunners(onlyVettedActive?: boolean): Promise<RunnerProfile[]>;
  getRunner(id: string): Promise<RunnerProfile | undefined>;
  upsertRunner(runner: RunnerProfile): Promise<RunnerProfile>;

  exportSnapshot(): Promise<DbSnapshot>;
}

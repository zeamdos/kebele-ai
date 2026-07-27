import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config, isLive } from "@/lib/env";
import { upstreamError } from "@/lib/errors";
import type { Repository } from "@/lib/db/repository";
import type {
  DocumentReading,
  ErrandTask,
  FormFillSession,
  PaymentRecord,
  RunnerProfile,
  UserProfile,
  DbSnapshot,
} from "@/lib/types";
import { notFound } from "@/lib/errors";

/**
 * Supabase-backed repository. Used only when USE_REAL_SUPABASE / USE_REAL_APIS
 * is on and credentials are present. Schema lives in supabase/schema.sql.
 */
export class SupabaseRepository implements Repository {
  private readonly client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    const cfg = config().supabase;
    if (!client) {
      if (!cfg.url || !cfg.serviceRoleKey) {
        throw upstreamError("Supabase URL and service role key are required");
      }
      this.client = createClient(cfg.url, cfg.serviceRoleKey, {
        auth: { persistSession: false },
      });
    } else {
      this.client = client;
    }
  }

  async ensureSeed(): Promise<void> {
    // Seed is applied via SQL migrations / dashboard for live Supabase.
  }

  private async one<T>(
    table: string,
    column: string,
    value: string,
  ): Promise<T | undefined> {
    const { data, error } = await this.client
      .from(table)
      .select("*")
      .eq(column, value)
      .maybeSingle();
    if (error) throw upstreamError(error.message);
    return (data as T | null) ?? undefined;
  }

  async getUser(id: string): Promise<UserProfile | undefined> {
    return this.one<UserProfile>("users", "id", id);
  }

  async getUserByPhone(phone: string): Promise<UserProfile | undefined> {
    return this.one<UserProfile>("users", "phone", phone);
  }

  async upsertUser(user: UserProfile): Promise<UserProfile> {
    const { data, error } = await this.client
      .from("users")
      .upsert(user)
      .select("*")
      .single();
    if (error) throw upstreamError(error.message);
    return data as UserProfile;
  }

  async createDocument(doc: DocumentReading): Promise<DocumentReading> {
    const { data, error } = await this.client
      .from("documents")
      .insert(doc)
      .select("*")
      .single();
    if (error) throw upstreamError(error.message);
    return data as DocumentReading;
  }

  async getDocument(id: string): Promise<DocumentReading | undefined> {
    return this.one<DocumentReading>("documents", "id", id);
  }

  async updateDocument(
    id: string,
    patch: Partial<DocumentReading>,
  ): Promise<DocumentReading> {
    const { data, error } = await this.client
      .from("documents")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw upstreamError(error.message);
    if (!data) throw notFound(`Document ${id} not found`);
    return data as DocumentReading;
  }

  async listDocuments(userId: string): Promise<DocumentReading[]> {
    const { data, error } = await this.client
      .from("documents")
      .select("*")
      .eq("userId", userId)
      .order("createdAt", { ascending: false });
    if (error) throw upstreamError(error.message);
    return (data ?? []) as DocumentReading[];
  }

  async createFormSession(session: FormFillSession): Promise<FormFillSession> {
    const { data, error } = await this.client
      .from("form_sessions")
      .insert(session)
      .select("*")
      .single();
    if (error) throw upstreamError(error.message);
    return data as FormFillSession;
  }

  async getFormSession(id: string): Promise<FormFillSession | undefined> {
    return this.one<FormFillSession>("form_sessions", "id", id);
  }

  async updateFormSession(
    id: string,
    patch: Partial<FormFillSession>,
  ): Promise<FormFillSession> {
    const { data, error } = await this.client
      .from("form_sessions")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw upstreamError(error.message);
    if (!data) throw notFound(`Form session ${id} not found`);
    return data as FormFillSession;
  }

  async listFormSessions(userId: string): Promise<FormFillSession[]> {
    const { data, error } = await this.client
      .from("form_sessions")
      .select("*")
      .eq("userId", userId)
      .order("updatedAt", { ascending: false });
    if (error) throw upstreamError(error.message);
    return (data ?? []) as FormFillSession[];
  }

  async createPayment(payment: PaymentRecord): Promise<PaymentRecord> {
    const { data, error } = await this.client
      .from("payments")
      .insert(payment)
      .select("*")
      .single();
    if (error) throw upstreamError(error.message);
    return data as PaymentRecord;
  }

  async getPayment(id: string): Promise<PaymentRecord | undefined> {
    return this.one<PaymentRecord>("payments", "id", id);
  }

  async getPaymentByProviderRef(
    ref: string,
  ): Promise<PaymentRecord | undefined> {
    return this.one<PaymentRecord>("payments", "providerRef", ref);
  }

  async updatePayment(
    id: string,
    patch: Partial<PaymentRecord>,
  ): Promise<PaymentRecord> {
    const { data, error } = await this.client
      .from("payments")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw upstreamError(error.message);
    if (!data) throw notFound(`Payment ${id} not found`);
    return data as PaymentRecord;
  }

  async createErrand(task: ErrandTask): Promise<ErrandTask> {
    const { data, error } = await this.client
      .from("errands")
      .insert(task)
      .select("*")
      .single();
    if (error) throw upstreamError(error.message);
    return data as ErrandTask;
  }

  async getErrand(id: string): Promise<ErrandTask | undefined> {
    return this.one<ErrandTask>("errands", "id", id);
  }

  async updateErrand(
    id: string,
    patch: Partial<ErrandTask>,
  ): Promise<ErrandTask> {
    const { data, error } = await this.client
      .from("errands")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw upstreamError(error.message);
    if (!data) throw notFound(`Errand ${id} not found`);
    return data as ErrandTask;
  }

  async listErrands(filter?: {
    userId?: string;
    runnerId?: string;
    status?: ErrandTask["status"];
  }): Promise<ErrandTask[]> {
    let query = this.client.from("errands").select("*");
    if (filter?.userId) query = query.eq("userId", filter.userId);
    if (filter?.runnerId) query = query.eq("runnerId", filter.runnerId);
    if (filter?.status) query = query.eq("status", filter.status);
    const { data, error } = await query.order("createdAt", { ascending: false });
    if (error) throw upstreamError(error.message);
    return (data ?? []) as ErrandTask[];
  }

  async listRunners(onlyVettedActive = true): Promise<RunnerProfile[]> {
    let query = this.client.from("runners").select("*");
    if (onlyVettedActive) {
      query = query.eq("vetted", true).eq("active", true);
    }
    const { data, error } = await query;
    if (error) throw upstreamError(error.message);
    return (data ?? []) as RunnerProfile[];
  }

  async getRunner(id: string): Promise<RunnerProfile | undefined> {
    return this.one<RunnerProfile>("runners", "id", id);
  }

  async upsertRunner(runner: RunnerProfile): Promise<RunnerProfile> {
    const { data, error } = await this.client
      .from("runners")
      .upsert(runner)
      .select("*")
      .single();
    if (error) throw upstreamError(error.message);
    return data as RunnerProfile;
  }

  async exportSnapshot(): Promise<DbSnapshot> {
    const [users, documents, formSessions, payments, errands, runners] =
      await Promise.all([
        this.client.from("users").select("*"),
        this.client.from("documents").select("*"),
        this.client.from("form_sessions").select("*"),
        this.client.from("payments").select("*"),
        this.client.from("errands").select("*"),
        this.client.from("runners").select("*"),
      ]);
    for (const result of [
      users,
      documents,
      formSessions,
      payments,
      errands,
      runners,
    ]) {
      if (result.error) throw upstreamError(result.error.message);
    }
    return {
      users: (users.data ?? []) as UserProfile[],
      documents: (documents.data ?? []) as DocumentReading[],
      formSessions: (formSessions.data ?? []) as FormFillSession[],
      payments: (payments.data ?? []) as PaymentRecord[],
      errands: (errands.data ?? []) as ErrandTask[],
      runners: (runners.data ?? []) as RunnerProfile[],
    };
  }
}

export function shouldUseSupabase(): boolean {
  return isLive("supabase");
}

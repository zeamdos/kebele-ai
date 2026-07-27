import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/env";
import { newId, nowIso } from "@/lib/ids";
import { notFound } from "@/lib/errors";
import type { Repository } from "@/lib/db/repository";
import type {
  DbSnapshot,
  DocumentReading,
  ErrandTask,
  FormFillSession,
  PaymentRecord,
  RunnerProfile,
  UserProfile,
} from "@/lib/types";

const emptySnapshot = (): DbSnapshot => ({
  users: [],
  documents: [],
  formSessions: [],
  payments: [],
  errands: [],
  runners: [],
});

export class MemoryRepository implements Repository {
  private data: DbSnapshot = emptySnapshot();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filePath = config().db.file) {}

  async ensureSeed(): Promise<void> {
    await this.load();
    if (this.data.users.length === 0) {
      const demoUser: UserProfile = {
        id: "user_demo_citizen",
        phone: "+251911000001",
        displayName: "Abebe Kebede",
        role: "citizen",
        createdAt: nowIso(),
      };
      const runnerUser: UserProfile = {
        id: "user_demo_runner",
        phone: "+251911000002",
        displayName: "Sara Runner",
        role: "runner",
        createdAt: nowIso(),
      };
      this.data.users.push(demoUser, runnerUser);
      this.data.runners.push({
        id: "runner_demo_1",
        userId: runnerUser.id,
        displayName: "Sara Runner",
        phone: runnerUser.phone,
        kebeles: ["Bole 03", "Bole 08", "Kirkos 05"],
        vetted: true,
        active: true,
      });
      await this.persist();
    }
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    if (!this.filePath) {
      this.loaded = true;
      return;
    }
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.data = { ...emptySnapshot(), ...JSON.parse(raw) };
    } catch {
      this.data = emptySnapshot();
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    if (!this.filePath) return;
    const file = this.filePath;
    const payload = JSON.stringify(this.data, null, 2);
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, payload, "utf8");
    });
    await this.writeChain;
  }

  async getUser(id: string): Promise<UserProfile | undefined> {
    await this.load();
    return this.data.users.find((u) => u.id === id);
  }

  async getUserByPhone(phone: string): Promise<UserProfile | undefined> {
    await this.load();
    return this.data.users.find((u) => u.phone === phone);
  }

  async upsertUser(user: UserProfile): Promise<UserProfile> {
    await this.load();
    const idx = this.data.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) this.data.users[idx] = user;
    else this.data.users.push(user);
    await this.persist();
    return user;
  }

  async createDocument(doc: DocumentReading): Promise<DocumentReading> {
    await this.load();
    this.data.documents.push(doc);
    await this.persist();
    return doc;
  }

  async getDocument(id: string): Promise<DocumentReading | undefined> {
    await this.load();
    return this.data.documents.find((d) => d.id === id);
  }

  async updateDocument(
    id: string,
    patch: Partial<DocumentReading>,
  ): Promise<DocumentReading> {
    await this.load();
    const idx = this.data.documents.findIndex((d) => d.id === id);
    if (idx < 0) throw notFound(`Document ${id} not found`);
    this.data.documents[idx] = { ...this.data.documents[idx], ...patch, id };
    await this.persist();
    return this.data.documents[idx];
  }

  async listDocuments(userId: string): Promise<DocumentReading[]> {
    await this.load();
    return this.data.documents
      .filter((d) => d.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createFormSession(session: FormFillSession): Promise<FormFillSession> {
    await this.load();
    this.data.formSessions.push(session);
    await this.persist();
    return session;
  }

  async getFormSession(id: string): Promise<FormFillSession | undefined> {
    await this.load();
    return this.data.formSessions.find((s) => s.id === id);
  }

  async updateFormSession(
    id: string,
    patch: Partial<FormFillSession>,
  ): Promise<FormFillSession> {
    await this.load();
    const idx = this.data.formSessions.findIndex((s) => s.id === id);
    if (idx < 0) throw notFound(`Form session ${id} not found`);
    this.data.formSessions[idx] = {
      ...this.data.formSessions[idx],
      ...patch,
      id,
      updatedAt: nowIso(),
    };
    await this.persist();
    return this.data.formSessions[idx];
  }

  async listFormSessions(userId: string): Promise<FormFillSession[]> {
    await this.load();
    return this.data.formSessions
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async createPayment(payment: PaymentRecord): Promise<PaymentRecord> {
    await this.load();
    this.data.payments.push(payment);
    await this.persist();
    return payment;
  }

  async getPayment(id: string): Promise<PaymentRecord | undefined> {
    await this.load();
    return this.data.payments.find((p) => p.id === id);
  }

  async getPaymentByProviderRef(
    ref: string,
  ): Promise<PaymentRecord | undefined> {
    await this.load();
    return this.data.payments.find((p) => p.providerRef === ref);
  }

  async updatePayment(
    id: string,
    patch: Partial<PaymentRecord>,
  ): Promise<PaymentRecord> {
    await this.load();
    const idx = this.data.payments.findIndex((p) => p.id === id);
    if (idx < 0) throw notFound(`Payment ${id} not found`);
    this.data.payments[idx] = {
      ...this.data.payments[idx],
      ...patch,
      id,
      updatedAt: nowIso(),
    };
    await this.persist();
    return this.data.payments[idx];
  }

  async createErrand(task: ErrandTask): Promise<ErrandTask> {
    await this.load();
    this.data.errands.push(task);
    await this.persist();
    return task;
  }

  async getErrand(id: string): Promise<ErrandTask | undefined> {
    await this.load();
    return this.data.errands.find((e) => e.id === id);
  }

  async updateErrand(
    id: string,
    patch: Partial<ErrandTask>,
  ): Promise<ErrandTask> {
    await this.load();
    const idx = this.data.errands.findIndex((e) => e.id === id);
    if (idx < 0) throw notFound(`Errand ${id} not found`);
    this.data.errands[idx] = {
      ...this.data.errands[idx],
      ...patch,
      id,
      updatedAt: nowIso(),
    };
    await this.persist();
    return this.data.errands[idx];
  }

  async listErrands(filter?: {
    userId?: string;
    runnerId?: string;
    status?: ErrandTask["status"];
  }): Promise<ErrandTask[]> {
    await this.load();
    return this.data.errands
      .filter((e) => {
        if (filter?.userId && e.userId !== filter.userId) return false;
        if (filter?.runnerId && e.runnerId !== filter.runnerId) return false;
        if (filter?.status && e.status !== filter.status) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listRunners(onlyVettedActive = true): Promise<RunnerProfile[]> {
    await this.load();
    return this.data.runners.filter((r) =>
      onlyVettedActive ? r.vetted && r.active : true,
    );
  }

  async getRunner(id: string): Promise<RunnerProfile | undefined> {
    await this.load();
    return this.data.runners.find((r) => r.id === id);
  }

  async upsertRunner(runner: RunnerProfile): Promise<RunnerProfile> {
    await this.load();
    const idx = this.data.runners.findIndex((r) => r.id === runner.id);
    if (idx >= 0) this.data.runners[idx] = runner;
    else this.data.runners.push(runner);
    await this.persist();
    return runner;
  }

  async exportSnapshot(): Promise<DbSnapshot> {
    await this.load();
    return structuredClone(this.data);
  }
}

let repoSingleton: Repository | undefined;

export async function db(): Promise<Repository> {
  if (!repoSingleton) {
    repoSingleton = new MemoryRepository();
    await repoSingleton.ensureSeed();
  }
  return repoSingleton;
}

export function resetDbForTests(repo?: Repository): void {
  repoSingleton = repo;
}

export function demoUserId(): string {
  return "user_demo_citizen";
}

export function createDemoUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: overrides.id ?? newId("user"),
    phone: overrides.phone ?? "+251900000000",
    displayName: overrides.displayName ?? "Demo User",
    role: overrides.role ?? "citizen",
    createdAt: overrides.createdAt ?? nowIso(),
  };
}

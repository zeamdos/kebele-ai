import {
  MemoryRepository,
  resetDbForTests as resetMemoryDb,
} from "@/lib/db/memory";
import { shouldUseSupabase, SupabaseRepository } from "@/lib/db/supabase";
import type { Repository } from "@/lib/db/repository";

let singleton: Repository | undefined;

export async function db(): Promise<Repository> {
  if (singleton) return singleton;
  if (shouldUseSupabase()) {
    singleton = new SupabaseRepository();
    await singleton.ensureSeed();
    return singleton;
  }
  const memory = new MemoryRepository();
  await memory.ensureSeed();
  singleton = memory;
  return singleton;
}

export function resetDbForTests(repo?: Repository): void {
  singleton = repo;
  resetMemoryDb(repo);
}

export { MemoryRepository };
export type { Repository } from "@/lib/db/repository";
export { demoUserId } from "@/lib/db/memory";

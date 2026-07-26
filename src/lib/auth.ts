import { db, demoUserId } from "@/lib/db";
import { unauthorized } from "@/lib/errors";
import type { UserProfile } from "@/lib/types";

/**
 * MVP auth: demo user by default.
 * Pass `x-user-id` header to impersonate a seeded user (citizen/runner).
 * When Supabase Auth is wired later, swap this helper only.
 */
export async function requireUser(request: Request): Promise<UserProfile> {
  const headerId = request.headers.get("x-user-id")?.trim();
  const repo = await db();
  const user = await repo.getUser(headerId || demoUserId());
  if (!user) throw unauthorized();
  return user;
}

export async function optionalUser(
  request: Request,
): Promise<UserProfile | undefined> {
  try {
    return await requireUser(request);
  } catch {
    return undefined;
  }
}

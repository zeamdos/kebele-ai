import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    const repo = await db();
    return jsonOk(await repo.listRunners(true));
  } catch (error) {
    return jsonError(error);
  }
}

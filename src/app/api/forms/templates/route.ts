import { jsonOk } from "@/lib/http";
import { listFormTemplates } from "@/lib/forms/templates";

export const runtime = "nodejs";

export async function GET() {
  return jsonOk(listFormTemplates());
}

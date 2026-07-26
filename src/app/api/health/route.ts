import { config } from "@/lib/env";
import { jsonOk } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const cfg = config();
  return jsonOk({
    service: "kebele-navigator",
    useRealApis: cfg.useRealApis,
    modes: cfg.modes,
  });
}

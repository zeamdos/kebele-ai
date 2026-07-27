import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { jsonError, jsonOk, readJson } from "@/lib/http";
import { postErrand } from "@/lib/services/errands";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const repo = await db();
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    if (scope === "open") {
      return jsonOk(await repo.listErrands({ status: "posted" }));
    }
    if (user.role === "runner") {
      const runners = await repo.listRunners(false);
      const mine = runners.find((r) => r.userId === user.id);
      const assigned = mine
        ? await repo.listErrands({ runnerId: mine.id })
        : [];
      const open = await repo.listErrands({ status: "posted" });
      return jsonOk({ assigned, open });
    }
    return jsonOk(await repo.listErrands({ userId: user.id }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readJson<{
      title?: string;
      description?: string;
      kebeleOffice?: string;
      priceBirr?: number;
      contactPhone?: string;
      documentIds?: string[];
      formSessionId?: string;
    }>(request);

    if (!body.title || !body.kebeleOffice || !body.priceBirr) {
      throw badRequest("title, kebeleOffice, and priceBirr are required");
    }

    const result = await postErrand({
      userId: user.id,
      title: body.title,
      description: body.description ?? "",
      kebeleOffice: body.kebeleOffice,
      priceBirr: body.priceBirr,
      contactPhone: body.contactPhone ?? user.phone,
      documentIds: body.documentIds,
      formSessionId: body.formSessionId,
    });
    return jsonOk(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

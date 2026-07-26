import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { jsonError, jsonOk } from "@/lib/http";
import { completeErrand } from "@/lib/services/errands";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const { id } = await context.params;
    const repo = await db();
    const runners = await repo.listRunners(false);
    const runner = runners.find((r) => r.userId === user.id);
    if (!runner) throw badRequest("Only runners can complete errands");

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const note = String(form.get("note") ?? "");
      const file = form.get("photo");
      let photoBytes: Buffer | undefined;
      let photoMimeType: string | undefined;
      let photoFileName: string | undefined;
      if (file && typeof file !== "string") {
        photoBytes = Buffer.from(await file.arrayBuffer());
        photoMimeType = file.type;
        photoFileName = file.name;
      }
      return jsonOk(
        await completeErrand({
          errandId: id,
          runnerId: runner.id,
          note,
          photoBytes,
          photoMimeType,
          photoFileName,
        }),
      );
    }

    const body = (await request.json()) as { note?: string };
    return jsonOk(
      await completeErrand({
        errandId: id,
        runnerId: runner.id,
        note: body.note,
      }),
    );
  } catch (error) {
    return jsonError(error);
  }
}

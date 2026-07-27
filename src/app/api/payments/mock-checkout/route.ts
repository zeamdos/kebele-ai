import { completePayment } from "@/lib/services/payments";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * Mock Telebirr checkout page / completion endpoint.
 * Visiting or POSTing with ?ref=...&outcome=success completes the payment.
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const ref = url.searchParams.get("ref");
    const outcome =
      (url.searchParams.get("outcome") as "success" | "failure" | null) ??
      "success";
    if (!ref) {
      return new Response("Missing ref", { status: 400 });
    }
    const payment = await completePayment(ref, outcome);
    const returnTo = url.searchParams.get("returnTo") ?? "/forms";
    const html = `<!doctype html>
<html><head><meta charset="utf-8"/><title>Telebirr Mock Checkout</title>
<style>
  body{font-family:Georgia,serif;background:#f4efe4;color:#1c241f;display:grid;place-items:center;min-height:100vh;margin:0}
  .card{background:#fff;border:1px solid #c9b896;padding:2rem;max-width:28rem}
  a{color:#0f5c4c}
</style></head>
<body>
  <div class="card">
    <h1>Telebirr (mock)</h1>
    <p>Payment <strong>${payment.providerRef}</strong> is now <strong>${payment.status}</strong>.</p>
    <p>Amount: ${payment.amountBirr} ${payment.currency}</p>
    <p><a href="${returnTo}">Return to app</a></p>
  </div>
</body></html>`;
    // Fix accidental corruption in CSS - rewrite cleanly below if needed
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

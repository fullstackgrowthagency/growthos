import nacl from "tweetnacl";

/**
 * Verifies the Ed25519 signature HighLevel attaches to webhook deliveries
 * via the `X-GHL-Signature` header. `GHL_WEBHOOK_PUBLIC_KEY` is the
 * base64-encoded 32-byte public key published in HighLevel's developer
 * docs for your app.
 */
export function verifyGhlWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const publicKeyB64 = process.env.GHL_WEBHOOK_PUBLIC_KEY;
  if (!publicKeyB64) {
    throw new Error("GHL_WEBHOOK_PUBLIC_KEY is not configured");
  }

  try {
    const publicKey = Buffer.from(publicKeyB64, "base64");
    const signature = Buffer.from(signatureHeader, "base64");
    const message = new TextEncoder().encode(rawBody);
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}

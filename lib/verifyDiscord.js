import { createPublicKey, verify } from "node:crypto";

function toHexBuffer(value) {
  return Buffer.from(value, "hex");
}

function publicKeyToDer(publicKeyHex) {
  const rawKey = toHexBuffer(publicKeyHex);
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  return Buffer.concat([prefix, rawKey]);
}

export function verifyDiscordRequest({ body, signature, timestamp, publicKey }) {
  if (!body || !signature || !timestamp || !publicKey) {
    return false;
  }

  const key = createPublicKey({
    key: publicKeyToDer(publicKey),
    format: "der",
    type: "spki",
  });

  return verify(
    null,
    Buffer.from(timestamp + body),
    key,
    toHexBuffer(signature),
  );
}

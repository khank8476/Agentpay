import crypto from "node:crypto";

/**
 * High-Speed Ed25519 Micro-Voucher Engine
 * Sub-0.1ms signature verification for Solana and high-throughput streaming channels.
 */

export function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("hex"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("hex"),
    rawPublicKey: publicKey,
    rawPrivateKey: privateKey
  };
}

export function signEd25519Voucher(privateKeyDerHex, messageObject) {
  const serialized = Buffer.from(JSON.stringify(messageObject), "utf8");
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyDerHex, "hex"),
    format: "der",
    type: "pkcs8"
  });

  const signature = crypto.sign(null, serialized, privateKey);
  return {
    message: messageObject,
    signature: signature.toString("hex")
  };
}

export function verifyEd25519Voucher(messageObject, signatureHex, publicKeyDerHex) {
  const startTime = performance.now();

  try {
    const serialized = Buffer.from(JSON.stringify(messageObject), "utf8");
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyDerHex, "hex"),
      format: "der",
      type: "spki"
    });

    const isValid = crypto.verify(
      null,
      serialized,
      publicKey,
      Buffer.from(signatureHex, "hex")
    );

    const durationMs = performance.now() - startTime;
    return {
      valid: isValid,
      durationMs,
      error: isValid ? null : "Invalid Ed25519 signature"
    };
  } catch (err) {
    return {
      valid: false,
      durationMs: performance.now() - startTime,
      error: err.message
    };
  }
}


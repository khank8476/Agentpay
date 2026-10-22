import { verifyVoucher, signVoucher, hashResource } from "./crypto/eip712.js";
import { signEd25519Voucher, verifyEd25519Voucher, generateEd25519KeyPair } from "./crypto/ed25519.js";
import { NonceLedger } from "./channel/nonceLedger.js";
import { StateChannelManager } from "./channel/stateChannel.js";
import { DEFAULT_CONFIG, SCHEMES, EIP712_DOMAIN_NAME } from "./crypto/types.js";

export * from "./crypto/types.js";
export * from "./crypto/eip712.js";
export * from "./crypto/ed25519.js";
export * from "./channel/nonceLedger.js";
export * from "./channel/stateChannel.js";

/**
 * Unified Ultra-Fast AgentPay Verifier
 * Orchestrates Signature Check + Nonce Monotonic Check + Channel Solvency in < 1ms total.
 */
export class FastAgentPayEngine {
  constructor({
    recipientAddress,
    priceAtomic = 50000n, // $0.05 USDC (6 decimals)
    chainId = DEFAULT_CONFIG.DEFAULT_CHAIN_ID,
    maxWindowSeconds = DEFAULT_CONFIG.MAX_VALIDITY_SECONDS
  } = {}) {
    this.recipientAddress = recipientAddress;
    this.priceAtomic = BigInt(priceAtomic);
    this.chainId = chainId;
    this.nonceLedger = new NonceLedger({ maxWindowSeconds });
    this.channelManager = new StateChannelManager({ defaultRecipient: recipientAddress });
  }

  /**
   * Complete, failsafe verification pipeline.
   * Supports both:
   * 1. 'ed25519-stream' (Sub-0.2ms ultra-fast native C++ verification)
   * 2. 'eip712-voucher' (EVM L2 Base/Ethereum USDC standard)
   */
  verifyPayment({ voucher, signature, resourceUri }) {
    const totalStart = performance.now();

    // 1. Resource Hash Verification (< 0.05ms)
    const expectedResourceHash = hashResource(resourceUri);
    if (voucher.resourceHash && voucher.resourceHash !== expectedResourceHash) {
      return {
        verified: false,
        status: 403,
        error: "Resource binding mismatch: voucher was not signed for this URI",
        latencyMs: performance.now() - totalStart
      };
    }

    let cryptoDurationMs = 0;
    let agentAddress = voucher.agent;

    // 2. Cryptographic Signature Verification
    if (voucher.scheme === SCHEMES.ED25519_STREAM || voucher.scheme === "ed25519") {
      // Sub-0.2ms Ed25519 Native C++ Verification
      const edResult = verifyEd25519Voucher(voucher, signature, voucher.publicKey);
      cryptoDurationMs = edResult.durationMs;
      if (!edResult.valid) {
        return {
          verified: false,
          status: 401,
          error: edResult.error,
          latencyMs: performance.now() - totalStart
        };
      }
      agentAddress = voucher.publicKey;
    } else {
      // EIP-712 Standard ECDSA Recover
      const cryptoResult = verifyVoucher({ voucher, signature }, this.recipientAddress, this.chainId);
      cryptoDurationMs = cryptoResult.durationMs;
      if (!cryptoResult.valid) {
        return {
          verified: false,
          status: 401,
          error: cryptoResult.error,
          latencyMs: performance.now() - totalStart
        };
      }
      agentAddress = cryptoResult.agentAddress;
    }

    // 3. Monotonic Nonce & Anti-Replay Check (< 0.05ms)
    const nonceResult = this.nonceLedger.validateAndRecord(
      voucher.channelId,
      voucher.nonce
    );
    if (!nonceResult.valid) {
      return {
        verified: false,
        status: 409,
        error: nonceResult.error,
        latencyMs: performance.now() - totalStart
      };
    }

    // 4. Channel Solvency & Increment Verification (< 0.05ms)
    const channelResult = this.channelManager.processVoucherPayment({
      channelId: voucher.channelId,
      voucher,
      signature,
      requiredPrice: this.priceAtomic
    });
    if (!channelResult.success) {
      return {
        verified: false,
        status: 402,
        error: channelResult.error,
        latencyMs: performance.now() - totalStart
      };
    }

    const totalLatencyMs = performance.now() - totalStart;

    return {
      verified: true,
      status: 200,
      agentAddress,
      channelId: voucher.channelId,
      cumulativeClaimed: channelResult.cumulativeClaimed,
      remainingBalance: channelResult.remainingBalance,
      totalVisits: channelResult.totalVisits,
      latencyBreakdown: {
        cryptoMs: cryptoDurationMs,
        nonceMs: nonceResult.durationMs,
        channelMs: channelResult.durationMs,
        totalLatencyMs
      }
    };
  }
}

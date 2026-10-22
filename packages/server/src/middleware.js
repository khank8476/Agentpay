import { FastAgentPayEngine } from "../../core/src/index.js";
import { detectVisitorType } from "./agentDetector.js";

/**
 * Drop-in Pay-Per-Action (PPA) / Pay-Per-Visit (PPV) Middleware for Express / Node HTTP
 */
export function createPPVMiddleware(options = {}) {
  const {
    recipientAddress,
    priceUsd = 0.05,
    currency = "USDC",
    chainId = 8453, // Base Mainnet
    gateMode = "agents-only", // "agents-only" | "all-traffic"
    autoProvisionChannels = true, // auto-provisions channel with escrow credit
    defaultChannelDepositUsd = 10.0,
    debug = false
  } = options;

  if (!recipientAddress) {
    throw new Error("createPPVMiddleware: recipientAddress is required");
  }

  // Convert USD price to atomic units (USDC has 6 decimals, so $0.05 = 50,000)
  const priceAtomic = BigInt(Math.round(priceUsd * 1_000_000));
  const defaultDepositAtomic = BigInt(Math.round(defaultChannelDepositUsd * 1_000_000));

  const engine = new FastAgentPayEngine({
    recipientAddress,
    priceAtomic,
    chainId
  });

  return function ppvMiddleware(req, res, next) {
    const visitor = detectVisitorType(req);

    // If configured for agents only and this is a human browser, let them pass
    if (gateMode === "agents-only" && !visitor.isAgent) {
      req.visitorType = visitor;
      return next();
    }

    // Check for payment signature in headers
    // Standard x402 headers: 'payment-signature', 'x-payment', or 'authorization: x402 <base64>'
    const paymentHeader = req.headers["payment-signature"] ||
                          req.headers["x-payment"] ||
                          (req.headers["authorization"]?.startsWith("x402 ") ? req.headers["authorization"].slice(5) : null);

    const resourceUri = req.originalUrl || req.url;

    // Case 1: No payment header provided -> Return HTTP 402 Payment Required
    if (!paymentHeader) {
      const challengePayload = {
        version: "x402-v1.1",
        priceUsd,
        currency,
        priceAtomic: priceAtomic.toString(),
        chainId,
        recipient: recipientAddress,
        resourceUri,
        schemes: ["eip712-voucher", "ed25519-stream"],
        timestamp: Math.floor(Date.now() / 1000)
      };

      const base64Challenge = Buffer.from(JSON.stringify(challengePayload)).toString("base64");

      res.setHeader("Content-Type", "application/json");
      res.setHeader("PAYMENT-REQUIRED", base64Challenge);
      res.setHeader("WWW-Authenticate", `x402 scheme="eip712-voucher", token="${currency}", price="${priceUsd}", chainId="${chainId}", recipient="${recipientAddress}"`);

      return res.status(402).json({
        error: "Payment Required",
        code: 402,
        protocol: "x402",
        message: `Autonomous Agent access requires a micro-payment of $${priceUsd.toFixed(2)} ${currency} per visit/action.`,
        visitor: {
          detectedType: visitor.agentType,
          confidence: visitor.confidence
        },
        terms: challengePayload
      });
    }

    // Case 2: Payment header provided -> Run Ultra-Fast 1-2ms Verification Pipeline
    try {
      let parsedPayment;
      try {
        const decoded = Buffer.from(paymentHeader, "base64").toString("utf8");
        parsedPayment = JSON.parse(decoded);
      } catch {
        parsedPayment = typeof paymentHeader === "object" ? paymentHeader : JSON.parse(paymentHeader);
      }

      const { voucher, signature } = parsedPayment;

      if (!voucher || !signature) {
        return res.status(400).json({
          error: "Bad Request",
          message: "Malformed payment payload: missing voucher or signature"
        });
      }

      // Auto-provision channel in escrow ledger if not yet present
      if (autoProvisionChannels && voucher.channelId && !engine.channelManager.getChannel(voucher.channelId)) {
        engine.channelManager.registerChannel({
          channelId: voucher.channelId,
          agentAddress: voucher.agent,
          recipientAddress,
          depositAmount: defaultDepositAtomic,
          chainId
        });
      }

      // Hot-path verification
      const result = engine.verifyPayment({
        voucher,
        signature,
        resourceUri
      });

      if (!result.verified) {
        return res.status(result.status || 402).json({
          error: "Payment Verification Failed",
          code: result.status,
          message: result.error,
          latencyMs: result.latencyMs
        });
      }

      // Success: Attach verified payment details to request
      req.agentPayment = {
        verified: true,
        agentAddress: result.agentAddress,
        channelId: result.channelId,
        cumulativeClaimed: result.cumulativeClaimed,
        remainingBalance: result.remainingBalance,
        totalVisits: result.totalVisits,
        latencyMs: result.latencyBreakdown.totalLatencyMs
      };

      // Add settlement confirmation headers
      const receipt = {
        status: "settled_channel",
        channelId: result.channelId,
        agent: result.agentAddress,
        remainingBalanceUsd: (Number(result.remainingBalance) / 1e6).toFixed(4),
        totalVisits: result.totalVisits,
        verifiedInMs: result.latencyBreakdown.totalLatencyMs.toFixed(3)
      };

      res.setHeader("PAYMENT-RESPONSE", Buffer.from(JSON.stringify(receipt)).toString("base64"));
      res.setHeader("X-PPV-Verified-In", `${result.latencyBreakdown.totalLatencyMs.toFixed(3)}ms`);
      res.setHeader("Server-Timing", `ppv;dur=${result.latencyBreakdown.totalLatencyMs.toFixed(3)}`);

      if (debug) {
        console.log(`[PPV-GATE] Verified payment from ${result.agentAddress} in ${result.latencyBreakdown.totalLatencyMs.toFixed(3)}ms`);
      }

      return next();
    } catch (err) {
      return res.status(500).json({
        error: "Internal Verification Error",
        message: err.message
      });
    }
  };
}

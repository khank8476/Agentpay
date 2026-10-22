import { AgentWallet } from "./agentWallet.js";

/**
 * Transparent AI Agent HTTP Client with Automated x402 Micropayment Negotiation
 */
export class PPVAgentClient {
  constructor({
    wallet,
    privateKey,
    maxBudgetPerTaskUsd = 1.0,
    maxPricePerActionUsd = 0.10,
    agentName = "AutonomousAgent-v1"
  } = {}) {
    this.wallet = wallet || new AgentWallet({
      privateKey,
      maxBudgetPerTaskUsd,
      maxPricePerActionUsd
    });
    this.agentName = agentName;
  }

  /**
   * Transparent fetch wrapper.
   * If a site responds with 402, automatically signs voucher and retries seamlessly.
   */
  async fetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("User-Agent", `${this.agentName} (x402-enabled; agentAddress=${this.wallet.address})`);
    headers.set("X-Agent-Type", "autonomous-ai-agent");
    headers.set("X-Agent-ID", this.wallet.address);
    headers.set("Accept", headers.get("Accept") || "application/json, text/markdown, text/html");

    const reqStart = performance.now();

    // 1. First attempt: standard request
    const response = await fetch(url, { ...options, headers });

    // If resource is free or already accessible, return immediately
    if (response.status !== 402) {
      return response;
    }

    // 2. HTTP 402 Payment Required: negotiate micropayment terms
    const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED");
    let terms;

    if (paymentRequiredHeader) {
      try {
        const decoded = Buffer.from(paymentRequiredHeader, "base64").toString("utf8");
        terms = JSON.parse(decoded);
      } catch {
        terms = await response.clone().json().then(j => j.terms);
      }
    } else {
      const body = await response.clone().json();
      terms = body.terms;
    }

    if (!terms) {
      throw new Error(`Server returned 402 Payment Required but omitted valid x402 payment terms`);
    }

    const resourceUri = new URL(url).pathname + new URL(url).search;

    // 3. Agent wallet automatically signs payment voucher in ~0.2ms
    const signStart = performance.now();
    const paymentPayload = await this.wallet.signPaymentForChallenge(terms, resourceUri);
    const signDurationMs = performance.now() - signStart;

    // 4. Retry request with signed micropayment header
    const retryHeaders = new Headers(headers);
    const encodedSignature = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
    retryHeaders.set("PAYMENT-SIGNATURE", encodedSignature);

    const paidResponse = await fetch(url, {
      ...options,
      headers: retryHeaders
    });

    const totalRoundtripMs = performance.now() - reqStart;

    // Attach metadata for agent analytics
    paidResponse.x402Meta = {
      pricePaidUsd: terms.priceUsd,
      currency: terms.currency,
      recipient: terms.recipient,
      signDurationMs,
      totalRoundtripMs,
      serverVerifiedIn: paidResponse.headers.get("X-PPV-Verified-In") || "N/A"
    };

    return paidResponse;
  }
}

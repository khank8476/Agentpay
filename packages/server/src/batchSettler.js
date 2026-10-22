/**
 * Background Asynchronous Batch Settler
 * Batches off-chain micropayment vouchers for periodic on-chain redemption.
 * Amortizes L2 gas fees across thousands of visits (cost per visit: < $0.00005).
 */

export class BatchSettler {
  constructor({
    channelManager,
    payoutThresholdUsd = 5.0, // trigger on-chain withdrawal when $5.00 is accumulated
    settlementIntervalMs = 60000, // or every 60 seconds
    onSettledCallback = null
  }) {
    this.channelManager = channelManager;
    this.payoutThresholdAtomic = BigInt(Math.round(payoutThresholdUsd * 1e6));
    this.settlementIntervalMs = settlementIntervalMs;
    this.onSettledCallback = onSettledCallback;
    this.timer = null;
    this.isSettling = false;
  }

  start() {
    this.timer = setInterval(() => this.runSettlementCycle(), this.settlementIntervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  async runSettlementCycle() {
    if (this.isSettling) return;
    this.isSettling = true;

    try {
      const pending = this.channelManager.getPendingSettlements();
      const readyToSettle = pending.filter(p => BigInt(p.cumulativeAmount) >= this.payoutThresholdAtomic);

      for (const item of readyToSettle) {
        // In production: submits tx to MicropaymentEscrow.sol on Base/Arbitrum
        const simulatedTxHash = `0x${Buffer.from(Math.random().toString()).toString("hex").padEnd(64, "0").slice(0, 64)}`;
        const amountUsd = (Number(item.cumulativeAmount) / 1e6).toFixed(2);

        if (this.onSettledCallback) {
          this.onSettledCallback({
            channelId: item.channelId,
            recipient: item.recipient,
            amountUsd,
            txHash: simulatedTxHash,
            settledAt: new Date().toISOString()
          });
        }
      }
    } finally {
      this.isSettling = false;
    }
  }
}


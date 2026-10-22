/**
 * State Channel & Micropayment Balance Manager
 * Tracks escrow balance, cumulative claims, and pending payouts in memory (< 0.05ms check).
 */

export class StateChannelManager {
  constructor({ defaultRecipient } = {}) {
    this.defaultRecipient = defaultRecipient;
    // Map of channelId -> ChannelRecord
    this.channels = new Map();
  }

  /**
   * Registers or updates an on-chain escrow deposit for an agent
   */
  registerChannel({
    channelId,
    agentAddress,
    recipientAddress = this.defaultRecipient,
    depositAmount, // atomic USDC (e.g. 5_000_000 for $5.00)
    chainId = 8453
  }) {
    const existing = this.channels.get(channelId);
    if (existing) {
      existing.depositAmount = BigInt(depositAmount);
      return existing;
    }

    const channel = {
      channelId,
      agentAddress: agentAddress.toLowerCase(),
      recipientAddress: recipientAddress.toLowerCase(),
      depositAmount: BigInt(depositAmount),
      cumulativeClaimed: 0n,
      highestVoucher: null,
      totalVisits: 0,
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    };

    this.channels.set(channelId, channel);
    return channel;
  }

  /**
   * Fast-path check: validates whether the voucher's cumulative amount is
   * 1. Monotonically greater than previous cumulative claimed
   * 2. Within the deposited escrow balance (solvency check)
   * 3. Matches expected per-action increment (e.g. +$0.05)
   */
  processVoucherPayment({ channelId, voucher, signature, requiredPrice }) {
    const startTime = performance.now();
    const channel = this.channels.get(channelId);

    if (!channel) {
      return {
        success: false,
        error: `Channel ${channelId} not found or not funded`,
        durationMs: performance.now() - startTime
      };
    }

    const proposedCumulative = BigInt(voucher.cumulativeAmount);
    const requiredIncrement = BigInt(requiredPrice);

    // Check minimum increment
    const expectedMinCumulative = channel.cumulativeClaimed + requiredIncrement;
    if (proposedCumulative < expectedMinCumulative) {
      return {
        success: false,
        error: `Insufficient payment: voucher offers cumulative ${proposedCumulative}, requires >= ${expectedMinCumulative}`,
        durationMs: performance.now() - startTime
      };
    }

    // Solvency check: cumulative must not exceed total deposit
    if (proposedCumulative > channel.depositAmount) {
      return {
        success: false,
        error: `Channel insolvency: cumulative ${proposedCumulative} exceeds deposit ${channel.depositAmount}`,
        durationMs: performance.now() - startTime
      };
    }

    // Update channel state
    channel.cumulativeClaimed = proposedCumulative;
    channel.highestVoucher = { voucher, signature };
    channel.totalVisits += 1;
    channel.lastActiveAt = Date.now();

    const remainingBalance = channel.depositAmount - channel.cumulativeClaimed;

    return {
      success: true,
      channelId,
      cumulativeClaimed: channel.cumulativeClaimed.toString(),
      remainingBalance: remainingBalance.toString(),
      totalVisits: channel.totalVisits,
      durationMs: performance.now() - startTime
    };
  }

  getChannel(channelId) {
    return this.channels.get(channelId) || null;
  }

  /**
   * Retrieves all unsettled high-value vouchers for background batch settlement on-chain
   */
  getPendingSettlements() {
    const pending = [];
    for (const channel of this.channels.values()) {
      if (channel.highestVoucher && channel.cumulativeClaimed > 0n) {
        pending.push({
          channelId: channel.channelId,
          recipient: channel.recipientAddress,
          agent: channel.agentAddress,
          cumulativeAmount: channel.cumulativeClaimed.toString(),
          highestVoucher: channel.highestVoucher
        });
      }
    }
    return pending;
  }
}


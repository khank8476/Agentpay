import { ethers } from "ethers";
import { signVoucher } from "../../core/src/index.js";

/**
 * Autonomous Agent Wallet & Channel State Manager
 */
export class AgentWallet {
  constructor({
    privateKey,
    maxBudgetPerTaskUsd = 1.0,
    maxPricePerActionUsd = 0.10
  } = {}) {
    this.wallet = privateKey ? new ethers.Wallet(privateKey) : ethers.Wallet.createRandom();
    this.address = this.wallet.address;
    this.maxBudgetPerTaskAtomic = BigInt(Math.round(maxBudgetPerTaskUsd * 1e6));
    this.maxPricePerActionAtomic = BigInt(Math.round(maxPricePerActionUsd * 1e6));

    this.totalSpentAtomic = 0n;

    // Channel state: domain/recipient -> { channelId, nonce, cumulativeAmount, chainId }
    this.channelStates = new Map();
  }

  getChannelState(recipient, chainId = 8453) {
    const key = `${recipient.toLowerCase()}_${chainId}`;
    if (!this.channelStates.has(key)) {
      this.channelStates.set(key, {
        channelId: `chn_${this.address.slice(2, 8)}_${Date.now()}`,
        nonce: 0,
        cumulativeAmount: 0n,
        chainId
      });
    }
    return this.channelStates.get(key);
  }

  /**
   * Signs a micropayment voucher for a specific resource request
   */
  async signPaymentForChallenge(terms, resourceUri) {
    const priceAtomic = BigInt(terms.priceAtomic || Math.round(Number(terms.priceUsd) * 1e6));

    // Policy check 1: max price per single action
    if (priceAtomic > this.maxPricePerActionAtomic) {
      throw new Error(`Price $${(Number(priceAtomic) / 1e6).toFixed(2)} exceeds agent max limit of $${(Number(this.maxPricePerActionAtomic) / 1e6).toFixed(2)}`);
    }

    // Policy check 2: total task budget
    if (this.totalSpentAtomic + priceAtomic > this.maxBudgetPerTaskAtomic) {
      throw new Error(`Agent budget exhausted: spent $${(Number(this.totalSpentAtomic) / 1e6).toFixed(2)}, limit $${(Number(this.maxBudgetPerTaskAtomic) / 1e6).toFixed(2)}`);
    }

    const recipient = terms.recipient;
    const chainId = terms.chainId || 8453;
    const channel = this.getChannelState(recipient, chainId);

    channel.nonce += 1;
    channel.cumulativeAmount += priceAtomic;
    this.totalSpentAtomic += priceAtomic;

    const signed = await signVoucher(this.wallet, {
      channelId: channel.channelId,
      recipient,
      cumulativeAmount: channel.cumulativeAmount,
      nonce: channel.nonce,
      resourceUri,
      chainId
    });

    return signed;
  }

  getSummary() {
    return {
      agentAddress: this.address,
      totalSpentUsd: (Number(this.totalSpentAtomic) / 1e6).toFixed(4),
      activeChannels: this.channelStates.size
    };
  }
}


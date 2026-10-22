/**
 * AgentPay Protocol Specification Types & EIP-712 Schema
 * Standardized for EVM (Base / Arbitrum / Ethereum) and Ed25519 (Solana / High-Throughput)
 */

export const PROTOCOL_VERSION = "x402-v1.1-flash";

export const EIP712_DOMAIN_NAME = "AgentPay-Protocol";
export const EIP712_DOMAIN_VERSION = "1";

export const EIP712_TYPES = {
  ActionVoucher: [
    { name: "channelId", type: "string" },
    { name: "recipient", type: "address" },
    { name: "agent", type: "address" },
    { name: "cumulativeAmount", type: "uint256" }, // USDC micro-units (6 decimals: 50000 = $0.05)
    { name: "nonce", type: "uint256" },
    { name: "resourceHash", type: "bytes32" },
    { name: "expiry", type: "uint256" }
  ]
};

export const SCHEMES = {
  EIP712_VOUCHER: "eip712-voucher",
  ED25519_STREAM: "ed25519-stream"
};

export const DEFAULT_CONFIG = {
  DEFAULT_PRICE_USD: 0.05,
  USDC_DECIMALS: 6,
  MAX_VALIDITY_SECONDS: 120, // 2-minute validity window
  MAX_CLOCK_SKEW_SECONDS: 30, // 30-second clock skew tolerance
  DEFAULT_CHAIN_ID: 8453 // Base Mainnet (fast & low-fee L2)
};


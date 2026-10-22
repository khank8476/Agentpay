import { generateEd25519KeyPair, signEd25519Voucher, verifyEd25519Voucher } from "../src/crypto/ed25519.js";

function runEd25519Benchmark() {
  console.log("⚡ TESTING NATIVE ED25519 VOUCHER SPEED ⚡");
  const keypair = generateEd25519KeyPair();
  const sampleMessage = {
    channelId: "chn_solana_123",
    recipient: "PubkeyWebsite123",
    cumulativeAmount: 50000,
    nonce: 101,
    resource: "/articles/gpu-review",
    timestamp: Date.now()
  };

  const { signature } = signEd25519Voucher(keypair.privateKey, sampleMessage);

  // Warmup
  for (let i = 0; i < 20; i++) {
    verifyEd25519Voucher(sampleMessage, signature, keypair.publicKey);
  }

  const times = [];
  for (let i = 0; i < 100; i++) {
    const res = verifyEd25519Voucher(sampleMessage, signature, keypair.publicKey);
    times.push(res.durationMs);
  }

  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const p50 = times[Math.floor(times.length * 0.50)];
  const p95 = times[Math.floor(times.length * 0.95)];

  console.log(`Native Ed25519 Avg Latency: ${avg.toFixed(3)} ms`);
  console.log(`Native Ed25519 p50:         ${p50.toFixed(3)} ms`);
  console.log(`Native Ed25519 p95:         ${p95.toFixed(3)} ms`);
}

runEd25519Benchmark();


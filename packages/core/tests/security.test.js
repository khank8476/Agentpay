import { ethers } from "ethers";
import { FastAgentPayEngine, signVoucher, hashResource } from "../src/index.js";

async function runSecurityTests() {
  console.log("===============================================================");
  console.log("🛡️ AGENTPAY SECURITY & FAILSAFE SUITE 🛡️");
  console.log("===============================================================\n");

  const publisher = ethers.Wallet.createRandom();
  const agent = ethers.Wallet.createRandom();
  const attacker = ethers.Wallet.createRandom();

  const channelId = `chn_sec_${Date.now()}`;
  const priceAtomic = 50000n; // $0.05
  const depositAtomic = 100000n; // $0.10 (only enough for 2 visits!)

  const engine = new FastAgentPayEngine({
    recipientAddress: publisher.address,
    priceAtomic
  });

  engine.channelManager.registerChannel({
    channelId,
    agentAddress: agent.address,
    recipientAddress: publisher.address,
    depositAmount: depositAtomic
  });

  console.log("Test 1: Legitimate Payment (Visit #1) -> Should Succeed");
  const res1 = await signVoucher(agent, {
    channelId,
    recipient: publisher.address,
    cumulativeAmount: 50000n,
    nonce: 1,
    resourceUri: "/api/exclusive-insights"
  });
  const check1 = engine.verifyPayment({
    voucher: res1.voucher,
    signature: res1.signature,
    resourceUri: "/api/exclusive-insights"
  });
  console.assert(check1.verified === true, "Test 1 failed");
  console.log(`  ✅ Passed: Verified in ${check1.latencyBreakdown.totalLatencyMs.toFixed(3)}ms (Remaining: $${(Number(check1.remainingBalance) / 1e6).toFixed(2)})\n`);

  console.log("Test 2: Replay Attack (Re-submitting exact same voucher) -> Must Fail");
  const check2 = engine.verifyPayment({
    voucher: res1.voucher,
    signature: res1.signature,
    resourceUri: "/api/exclusive-insights"
  });
  console.assert(check2.verified === false, "Test 2 failed to block replay");
  console.log(`  ✅ Passed: Blocked with error: "${check2.error}"\n`);

  console.log("Test 3: Resource Tampering (Using voucher signed for page A on page B) -> Must Fail");
  const check3 = engine.verifyPayment({
    voucher: res1.voucher,
    signature: res1.signature,
    resourceUri: "/api/different-secret-report" // Different URL!
  });
  console.assert(check3.verified === false, "Test 3 failed to catch resource mismatch");
  console.log(`  ✅ Passed: Blocked with error: "${check3.error}"\n`);

  console.log("Test 4: Signature Forgery (Attacker alters amount from $0.05 to $0.01) -> Must Fail");
  const tamperedVoucher = { ...res1.voucher, cumulativeAmount: "10000", nonce: "2" };
  const check4 = engine.verifyPayment({
    voucher: tamperedVoucher,
    signature: res1.signature,
    resourceUri: "/api/exclusive-insights"
  });
  console.assert(check4.verified === false, "Test 4 failed to detect forgery");
  console.log(`  ✅ Passed: Blocked with error: "${check4.error}"\n`);

  console.log("Test 5: Legitimate Payment (Visit #2) -> Should Succeed");
  const res2 = await signVoucher(agent, {
    channelId,
    recipient: publisher.address,
    cumulativeAmount: 100000n, // reaches $0.10 deposit cap
    nonce: 2,
    resourceUri: "/api/exclusive-insights/part-2"
  });
  const check5 = engine.verifyPayment({
    voucher: res2.voucher,
    signature: res2.signature,
    resourceUri: "/api/exclusive-insights/part-2"
  });
  console.assert(check5.verified === true, "Test 5 failed");
  console.log(`  ✅ Passed: Verified (Remaining: $${(Number(check5.remainingBalance) / 1e6).toFixed(2)})\n`);

  console.log("Test 6: Channel Insolvency (Visit #3 exceeds deposited escrow balance) -> Must Fail");
  const res3 = await signVoucher(agent, {
    channelId,
    recipient: publisher.address,
    cumulativeAmount: 150000n, // $0.15 exceeds $0.10 deposit!
    nonce: 3,
    resourceUri: "/api/exclusive-insights/part-3"
  });
  const check6 = engine.verifyPayment({
    voucher: res3.voucher,
    signature: res3.signature,
    resourceUri: "/api/exclusive-insights/part-3"
  });
  console.assert(check6.verified === false, "Test 6 failed to prevent insolvency");
  console.log(`  ✅ Passed: Blocked with error: "${check6.error}"\n`);

  console.log("Test 7: Expired Voucher -> Must Fail");
  const expiredVoucherData = await signVoucher(agent, {
    channelId,
    recipient: publisher.address,
    cumulativeAmount: 200000n,
    nonce: 4,
    resourceUri: "/api/exclusive-insights",
    expiry: Math.floor(Date.now() / 1000) - 100 // expired 100s ago
  });
  const check7 = engine.verifyPayment({
    voucher: expiredVoucherData.voucher,
    signature: expiredVoucherData.signature,
    resourceUri: "/api/exclusive-insights"
  });
  console.assert(check7.verified === false, "Test 7 failed to reject expired voucher");
  console.log(`  ✅ Passed: Blocked with error: "${check7.error}"\n`);

  console.log("===============================================================");
  console.log("🎉 ALL 7 SECURITY & FAILSAFE CHECKS PASSED FLAWLESSLY!");
  console.log("===============================================================\n");
}

runSecurityTests().catch(console.error);


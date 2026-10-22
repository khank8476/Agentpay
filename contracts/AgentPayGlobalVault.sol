// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentPayGlobalVault
 * @notice Global Pooled Escrow & Batch Settlement for the Agentic Web (x402 Standard).
 * @dev Single contract deployed ONCE on Base/Arbitrum that serves ALL websites and ALL AI agents.
 * 
 * Key Innovations:
 * 1. ONE Contract for the entire internet: Publishers don't deploy anything; they just pass their wallet address.
 * 2. ONE Global Deposit for the AI Agent: Agent deposits $10 once, spends $0.05 across 100 different websites.
 * 3. Publisher Batch Settlement: A website accumulates $0.05 from 100 different agents and cashes out $5.00 in 1 tx.
 * 4. Zero Locked Funds Trap: Agent can withdraw unreserved funds instantly at any time.
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract AgentPayGlobalVault {
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant VOUCHER_TYPEHASH = keccak256("GlobalActionVoucher(address agent,address recipient,uint256 amount,uint256 nonce,bytes32 resourceHash,uint256 expiry)");

    bytes32 public immutable DOMAIN_SEPARATOR;
    IERC20 public immutable paymentToken; // e.g. USDC on Base (6 decimals)

    // Agent Address => Total Deposited Available Balance
    mapping(address => uint256) public agentBalances;

    // Agent Address => Highest Settled Nonce (Strict monotonic anti-replay)
    mapping(address => uint256) public agentNonces;

    // Agent Address => Specific Nonce Used Bitmask/Mapping (Allows concurrent multi-site vouchers)
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // Publisher Address => Accrued Withdrawable Balance
    mapping(address => uint256) public publisherEarnings;

    struct GlobalActionVoucher {
        address agent;
        address recipient;
        uint256 amount;        // Micro-fee (e.g. 50,000 = $0.05 USDC)
        uint256 nonce;
        bytes32 resourceHash;
        uint256 expiry;
        bytes signature;
    }

    event Deposited(address indexed agent, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed agent, uint256 amount, uint256 remainingBalance);
    event VoucherSettled(address indexed agent, address indexed recipient, uint256 amount, uint256 nonce);
    event PublisherPaid(address indexed recipient, uint256 amount);

    constructor(address _paymentToken) {
        paymentToken = IERC20(_paymentToken);
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("AgentPay-GlobalVault")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // =========================================================================
    // 1. AGENT ACTIONS: DEPOSIT & WITHDRAW (Zero Trapped Funds!)
    // =========================================================================

    /**
     * @notice Agent deposits USDC into their global vault balance.
     * Can be spent on ANY website using agentpay-protocol.
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "Deposit must be > 0");
        require(paymentToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        agentBalances[msg.sender] += amount;
        emit Deposited(msg.sender, amount, agentBalances[msg.sender]);
    }

    /**
     * @notice Agent can withdraw their unspent funds at ANY time.
     * No funds are ever locked or trapped.
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(agentBalances[msg.sender] >= amount, "Insufficient balance");

        agentBalances[msg.sender] -= amount;
        require(paymentToken.transfer(msg.sender, amount), "Transfer failed");

        emit Withdrawn(msg.sender, amount, agentBalances[msg.sender]);
    }

    // =========================================================================
    // 2. PUBLISHER BATCH SETTLEMENT (The "Visited Once" Solution!)
    // =========================================================================

    /**
     * @notice A website settles multiple vouchers from many DIFFERENT agents in 1 single transaction.
     * Solves the $0.05 single-visit problem: 100 single visits of $0.05 = $5.00 cashed out in 1 call!
     */
    function settleBatch(GlobalActionVoucher[] calldata vouchers) external {
        uint256 totalPublisherPayout = 0;

        for (uint256 i = 0; i < vouchers.length; i++) {
            GlobalActionVoucher calldata v = vouchers[i];

            // 1. Security & Expiry Checks
            if (block.timestamp > v.expiry) continue; // skip expired
            if (usedNonces[v.agent][v.nonce]) continue; // skip replayed
            if (agentBalances[v.agent] < v.amount) continue; // skip insolvent
            if (v.recipient != msg.sender) continue; // only intended recipient can claim

            // 2. Cryptographic EIP-712 Signature Recovery
            bytes32 structHash = keccak256(
                abi.encode(
                    VOUCHER_TYPEHASH,
                    v.agent,
                    v.recipient,
                    v.amount,
                    v.nonce,
                    v.resourceHash,
                    v.expiry
                )
            );
            bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
            address signer = recoverSigner(digest, v.signature);

            if (signer != v.agent) continue; // invalid signature, skip

            // 3. Deduct from agent global vault & credit publisher
            usedNonces[v.agent][v.nonce] = true;
            agentBalances[v.agent] -= v.amount;
            totalPublisherPayout += v.amount;

            emit VoucherSettled(v.agent, v.recipient, v.amount, v.nonce);
        }

        // 4. Transfer total aggregated USDC directly to publisher wallet in 1 transfer!
        if (totalPublisherPayout > 0) {
            require(paymentToken.transfer(msg.sender, totalPublisherPayout), "Payout transfer failed");
            emit PublisherPaid(msg.sender, totalPublisherPayout);
        }
    }

    function recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        return ecrecover(hash, v, r, s);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MicropaymentEscrow
 * @notice High-performance state channel escrow for autonomous AI agent micropayments (USDC/USDT).
 * @dev Optimized for EVM L2s (Base, Arbitrum, Optimism) with minimal gas overhead.
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MicropaymentEscrow {
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant VOUCHER_TYPEHASH = keccak256("ActionVoucher(string channelId,address recipient,address agent,uint256 cumulativeAmount,uint256 nonce,bytes32 resourceHash,uint256 expiry)");

    bytes32 public immutable DOMAIN_SEPARATOR;
    IERC20 public immutable paymentToken; // e.g. USDC on Base

    struct Channel {
        address agent;
        address recipient;
        uint256 deposit;
        uint256 settledAmount;
        uint256 lastNonce;
        uint256 closeRequestedAt;
        bool isClosed;
    }

    struct ActionVoucher {
        string channelId;
        address recipient;
        address agent;
        uint256 cumulativeAmount;
        uint256 nonce;
        bytes32 resourceHash;
        uint256 expiry;
    }

    uint256 public constant DISPUTE_PERIOD = 24 hours;

    mapping(bytes32 => Channel) public channels;

    event ChannelOpened(bytes32 indexed channelKey, address indexed agent, address indexed recipient, uint256 deposit);
    event ChannelDepositAdded(bytes32 indexed channelKey, uint256 addedAmount);
    event ChannelSettled(bytes32 indexed channelKey, address indexed recipient, uint256 payoutAmount, uint256 cumulativeAmount);
    event ChannelCloseRequested(bytes32 indexed channelKey, uint256 unlockTime);
    event ChannelClosed(bytes32 indexed channelKey, uint256 refundedToAgent);

    constructor(address _paymentToken) {
        paymentToken = IERC20(_paymentToken);
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("AgentPay-Protocol")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function getChannelKey(string memory channelId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(channelId));
    }

    /**
     * @notice Open or top up an escrow channel for a publisher/website
     */
    function openOrTopUpChannel(string calldata channelId, address recipient, uint256 amount) external {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Deposit must be > 0");

        bytes32 key = getChannelKey(channelId);
        Channel storage ch = channels[key];

        require(paymentToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        if (ch.agent == address(0)) {
            ch.agent = msg.sender;
            ch.recipient = recipient;
            ch.deposit = amount;
            emit ChannelOpened(key, msg.sender, recipient, amount);
        } else {
            require(ch.agent == msg.sender, "Only agent can top up");
            require(!ch.isClosed, "Channel is closed");
            ch.deposit += amount;
            emit ChannelDepositAdded(key, amount);
        }
    }

    /**
     * @notice Publisher submits highest signed voucher to claim accrued earnings
     */
    function settleVoucher(
        ActionVoucher calldata voucher,
        bytes calldata signature
    ) external {
        bytes32 key = getChannelKey(voucher.channelId);
        Channel storage ch = channels[key];

        require(ch.agent != address(0), "Channel does not exist");
        require(!ch.isClosed, "Channel closed");
        require(msg.sender == voucher.recipient, "Only recipient can settle");
        require(voucher.agent == ch.agent, "Agent mismatch");
        require(voucher.recipient == ch.recipient, "Recipient mismatch");
        require(block.timestamp <= voucher.expiry, "Voucher expired");
        require(voucher.nonce > ch.lastNonce, "Nonce already settled");
        require(voucher.cumulativeAmount > ch.settledAmount, "Nothing to settle");
        require(voucher.cumulativeAmount <= ch.deposit, "Cumulative exceeds deposit");

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                VOUCHER_TYPEHASH,
                keccak256(bytes(voucher.channelId)),
                voucher.recipient,
                voucher.agent,
                voucher.cumulativeAmount,
                voucher.nonce,
                voucher.resourceHash,
                voucher.expiry
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address recoveredSigner = recoverSigner(digest, signature);
        require(recoveredSigner == ch.agent, "Invalid signature");

        // Calculate payout difference
        uint256 payout = voucher.cumulativeAmount - ch.settledAmount;
        ch.settledAmount = voucher.cumulativeAmount;
        ch.lastNonce = voucher.nonce;

        require(paymentToken.transfer(voucher.recipient, payout), "Payout transfer failed");
        emit ChannelSettled(key, voucher.recipient, payout, voucher.cumulativeAmount);
    }

    /**
     * @notice Agent initiates closing channel to recover unspent funds
     */
    function requestCloseChannel(string calldata channelId) external {
        bytes32 key = getChannelKey(channelId);
        Channel storage ch = channels[key];
        require(msg.sender == ch.agent, "Only agent can close");
        require(!ch.isClosed, "Already closed");
        require(ch.closeRequestedAt == 0, "Close already requested");

        ch.closeRequestedAt = block.timestamp;
        emit ChannelCloseRequested(key, block.timestamp + DISPUTE_PERIOD);
    }

    /**
     * @notice Finalize channel closure after dispute period passes
     */
    function finalizeCloseChannel(string calldata channelId) external {
        bytes32 key = getChannelKey(channelId);
        Channel storage ch = channels[key];
        require(!ch.isClosed, "Already closed");
        require(ch.closeRequestedAt > 0, "Close not requested");
        require(block.timestamp >= ch.closeRequestedAt + DISPUTE_PERIOD, "Dispute window active");

        ch.isClosed = true;
        uint256 refund = ch.deposit - ch.settledAmount;

        if (refund > 0) {
            require(paymentToken.transfer(ch.agent, refund), "Refund failed");
        }

        emit ChannelClosed(key, refund);
    }

    function recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
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


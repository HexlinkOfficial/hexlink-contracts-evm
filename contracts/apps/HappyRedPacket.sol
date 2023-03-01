//SPDX-License-Identifier: Unlicense

pragma solidity ^0.8.8;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "../utils/GasSponsor.sol";

contract HappyRedPacketImpl is Ownable, UUPSUpgradeable, GasSponsor {
    using ECDSA for bytes32;
    using Address for address;

    event Created(
        bytes32 indexed PacketId,
        address indexed creator,
        RedPacketData packet
    );
    event Claimed(
        bytes32 indexed PacketId,
        address indexed claimer,
        uint amount
    );

    struct RedPacketData {
        address creator;
        address token;
        bytes32 salt;
        uint256 balance;
        address validator;
        uint32 split;
        uint8 mode; // 0: not_set, 1: fixed, 2: randomized
        bool sponsorGas;
    }

    struct RedPacket {
        uint256 createdAt;
        uint256 balance;
        uint32 split;
        uint256 gasSponsorship;
    }
    // user => PacketId => Packet as Packet
    mapping(bytes32 => RedPacket) internal packets_;
    mapping(bytes32 => mapping(address => uint256)) internal count_;

    function initOwner(address newOwner) external {
        require(owner() == address(0), "Owner already set");
        require(newOwner != address(0), "Owner cannot be address zero");
        _transferOwnership(newOwner);
    }

    function create(RedPacketData calldata pd) external payable {
        require(pd.mode == 1 || pd.mode == 2, "Invalid mode");
        bytes32 packetId = _packetId(pd);
        require(packets_[packetId].createdAt == 0, "Packet already created");
        if (pd.token != address(0)) {
            IERC20(pd.token).transferFrom(msg.sender, address(this), pd.balance);
        } else {
            require(msg.value == pd.balance, "Insufficient balance");
        }
        packets_[packetId].balance += pd.balance;
        packets_[packetId].split += pd.split;
        packets_[packetId].createdAt = block.timestamp;
        emit Created(packetId, pd.creator, pd);
    }

    function getPacket(bytes32 id) external view returns(RedPacket memory) {
        return packets_[id];
    }

    function deposit(bytes32 packetId) external payable {        
        packets_[packetId].gasSponsorship += msg.value;
    }

    function getClaimedCount(
        bytes32 packetId,
        address claimer
    ) external view returns(uint256){
        return count_[packetId][claimer];
    }

    function refund(RedPacketData calldata pd) external {
        require(pd.creator == msg.sender, "Unauthorized");
        bytes32 packetId = _packetId(pd);
        // packet locked for one day before withdraw
        uint256 createdAt = packets_[packetId].createdAt;
        require(createdAt > 0, "Packet not found");
        require(block.timestamp - createdAt > 86400, "Packet locked");

        uint256 balance = packets_[packetId].balance;
        if (balance > 0) {
            packets_[packetId].balance = 0;
            _transfer(pd.token, msg.sender, balance);
        }
        uint256 depositLeft = packets_[packetId].gasSponsorship;
        if (depositLeft > 0) {
            packets_[packetId].gasSponsorship = 0;
            Address.sendValue(payable(msg.sender), depositLeft);
        }
    }

    function claim(
        RedPacketData calldata packet,
        address claimer,
        address refundReceiver,
        bytes calldata signature
    ) public {
        uint256 gasUsed = gasleft();
        bytes32 packetId = _packetId(packet);
        if (signature.length == 0) {
            require(msg.sender == packet.validator, "Unauthorized");
        } else {
            bytes32 message = keccak256(abi.encode(packetId, claimer, refundReceiver));
            bytes32 reqHash = message.toEthSignedMessageHash();
            require(packet.validator == reqHash.recover(signature), "Invalid signature");
        }
        _claim(packetId, packet, claimer);
        if (packet.sponsorGas && refundReceiver != address(0)) {
            uint256 payment = (gasUsed - gasleft() + 60000) * tx.gasprice;
            packets_[packetId].gasSponsorship -= payment;
            _sponsorGas(payment, refundReceiver);
        }
    }

    function _claim(
        bytes32 packetId,
        RedPacketData calldata pd,
        address claimer
    ) internal {
        _validateClaimer(packetId, claimer);
        RedPacket memory p = packets_[packetId];
        uint256 claimed = _claimd(claimer, pd.mode, p);
        packets_[packetId].balance = p.balance - claimed;
        packets_[packetId].split = p.split - 1;
        _transfer(pd.token, claimer, claimed);
        emit Claimed(packetId, claimer, claimed);
    }

    function _validateClaimer(bytes32 packetId, address claimer) internal {
        require(count_[packetId][claimer] == 0, "Already claimed");
        count_[packetId][claimer] += 1;
    }

    function _claimd(
        address claimer,
        uint8 mode,
        RedPacket memory p
    ) internal view returns(uint256 claimed) {
        require(p.balance > 0 && p.split > 0, "Empty Packet");
        if (p.split == 1) {
            claimed = p.balance;
        } else if (mode == 1) { // equally shared
            claimed = p.balance / p.split;
        } else if (mode == 2) { // randomized
            uint randomHash = uint(keccak256(
                abi.encode(claimer, block.difficulty, block.timestamp)
            ));
            uint maxPerShare = (p.balance / p.split) * 2;
            claimed = randomHash % maxPerShare;
        }
        if (claimed == 0) {
            claimed = 1;
        }
    }

    function _transfer(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            Address.sendValue(payable(to), amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }

    function _packetId(
        RedPacketData calldata pd
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), pd));
    }

    function implementation() external view returns (address) {
        return _getImplementation();
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal view onlyOwner override { }
}

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract HappyRedPacket is ERC1967Proxy {
    constructor(
        address logic,
        bytes memory data
    ) ERC1967Proxy(logic, data) payable {}
}

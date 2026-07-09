// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract InkPassClaim {
    struct Claim {
        address monadOwner;
        string suiObjectId;
        bytes32 proofHash;
        uint256 timestamp;
    }

    mapping(address => Claim[]) private claimsByOwner;
    mapping(bytes32 => bool) public proofUsed;

    event InkPassClaimed(address indexed user, string suiObjectId, bytes32 proofHash);

    error ProofAlreadyUsed();
    error EmptySuiObjectId();
    error EmptyProofHash();

    function claimInkPass(string calldata suiObjectId, bytes32 proofHash) external {
        if (bytes(suiObjectId).length == 0) revert EmptySuiObjectId();
        if (proofHash == bytes32(0)) revert EmptyProofHash();
        if (proofUsed[proofHash]) revert ProofAlreadyUsed();

        proofUsed[proofHash] = true;
        claimsByOwner[msg.sender].push(
            Claim({
                monadOwner: msg.sender,
                suiObjectId: suiObjectId,
                proofHash: proofHash,
                timestamp: block.timestamp
            })
        );

        emit InkPassClaimed(msg.sender, suiObjectId, proofHash);
    }

    function claimsOf(address owner) external view returns (Claim[] memory) {
        return claimsByOwner[owner];
    }
}

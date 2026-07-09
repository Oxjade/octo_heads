// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library Base64 {
    string internal constant TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";

        string memory table = TABLE;
        uint256 encodedLength = 4 * ((data.length + 2) / 3);
        string memory result = new string(encodedLength + 32);

        assembly {
            mstore(result, encodedLength)
            let tablePtr := add(table, 1)
            let dataPtr := data
            let endPtr := add(dataPtr, mload(data))
            let resultPtr := add(result, 32)

            for {} lt(dataPtr, endPtr) {} {
                dataPtr := add(dataPtr, 3)
                let input := mload(dataPtr)

                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))
                resultPtr := add(resultPtr, 1)
            }

            switch mod(mload(data), 3)
            case 1 {
                mstore8(sub(resultPtr, 1), 0x3d)
                mstore8(sub(resultPtr, 2), 0x3d)
            }
            case 2 {
                mstore8(sub(resultPtr, 1), 0x3d)
            }
        }

        return result;
    }
}

contract InkPassReceipt {
    string public name = "Ink Genesis Pass";
    string public symbol = "INKPASS";
    string public constant IMAGE_URI = "https://blue-historical-mink-951.mypinata.cloud/ipfs/bafkreihqp7t3lq7d3hifchcfanwqm5ezjrrfexf5yom6cy66jg422naqfm";

    uint256 public nextTokenId = 1;
    address public owner;
    address public ikaMinter;

    mapping(uint256 => address) private owners;
    mapping(address => uint256) private balances;
    mapping(uint256 => address) private tokenApprovals;
    mapping(address => mapping(address => bool)) private operatorApprovals;
    mapping(bytes32 => bool) public proofUsed;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event InkGenesisPassMinted(address indexed monadOwner, uint256 indexed tokenId, string suiReceiptId, bytes32 proofHash);

    error NotOwner();
    error NotApproved();
    error InvalidRecipient();
    error ProofAlreadyUsed();
    error EmptySuiObjectId();
    error EmptyProofHash();
    error NotIkaMinter();

    constructor(address initialIkaMinter) {
        owner = msg.sender;
        ikaMinter = initialIkaMinter == address(0) ? msg.sender : initialIkaMinter;
    }

    function setIkaMinter(address newIkaMinter) external {
        if (msg.sender != owner) revert NotOwner();
        if (newIkaMinter == address(0)) revert InvalidRecipient();
        ikaMinter = newIkaMinter;
    }

    function mintPass(address to, string calldata suiReceiptId, bytes32 proofHash) external returns (uint256 tokenId) {
        if (msg.sender != ikaMinter) revert NotIkaMinter();
        if (to == address(0)) revert InvalidRecipient();
        if (bytes(suiReceiptId).length == 0) revert EmptySuiObjectId();
        if (proofHash == bytes32(0)) revert EmptyProofHash();
        if (proofUsed[proofHash]) revert ProofAlreadyUsed();

        proofUsed[proofHash] = true;
        tokenId = nextTokenId++;
        balances[to] += 1;
        owners[tokenId] = to;

        emit Transfer(address(0), to, tokenId);
        emit InkGenesisPassMinted(to, tokenId, suiReceiptId, proofHash);
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        _requireOwned(tokenId);
        string memory json = Base64.encode(
            bytes(
                string.concat(
                    '{"name":"Ink Genesis Pass #',
                    _toString(tokenId),
                    '","description":"An Ink Genesis Pass NFT minted on Monad after Sui payment coordination through Ink and Ika.","image":"',
                    IMAGE_URI,
                    '","attributes":[{"trait_type":"NFT Chain","value":"Monad"},{"trait_type":"Payment Chain","value":"Sui"},{"trait_type":"Coordinated By","value":"Ink + Ika"},{"trait_type":"Signing","value":"dWallet"},{"trait_type":"Edition","value":"Genesis"}]}'
                )
            )
        );

        return string.concat("data:application/json;base64,", json);
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        return _requireOwned(tokenId);
    }

    function balanceOf(address account) external view returns (uint256) {
        if (account == address(0)) revert InvalidRecipient();
        return balances[account];
    }

    function approve(address to, uint256 tokenId) external {
        address tokenOwner = ownerOf(tokenId);
        if (msg.sender != tokenOwner && !operatorApprovals[tokenOwner][msg.sender]) revert NotApproved();
        tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        _requireOwned(tokenId);
        return tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address tokenOwner, address operator) external view returns (bool) {
        return operatorApprovals[tokenOwner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();
        if (ownerOf(tokenId) != from) revert NotOwner();
        if (to == address(0)) revert InvalidRecipient();

        delete tokenApprovals[tokenId];
        balances[from] -= 1;
        balances[to] += 1;
        owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata) external {
        transferFrom(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f;
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) private view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return spender == tokenOwner || tokenApprovals[tokenId] == spender || operatorApprovals[tokenOwner][spender];
    }

    function _requireOwned(uint256 tokenId) private view returns (address tokenOwner) {
        tokenOwner = owners[tokenId];
        if (tokenOwner == address(0)) revert InvalidRecipient();
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }
}

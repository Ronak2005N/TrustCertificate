// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CertChainRegistry {
    // --- Structs ---
    struct Certificate {
        bytes32 certificateHash;
        address issuerAddress;
        string ipfsCID;
        string certificateNumber;
        uint256 issueTimestamp;
        uint256 status; // 0 = Active, 1 = Revoked
    }

    // --- State ---
    address public superAdmin;
    mapping(string => Certificate) public certificates;
    mapping(address => bool) public authorizedIssuers;
    address[] public issuerList;
    string[] public certificateIds;

    // --- Events ---
    event IssuerAdded(address indexed issuer, uint256 timestamp);
    event IssuerRemoved(address indexed issuer, uint256 timestamp);
    event CertificateRegistered(
        string indexed certificateId,
        bytes32 indexed certificateHash,
        address indexed issuer,
        uint256 timestamp
    );
    event CertificateRevoked(string indexed certificateId, uint256 timestamp);

    // --- Modifiers ---
    modifier onlySuperAdmin() {
        require(msg.sender == superAdmin, "Only super admin");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender], "Not authorized issuer");
        _;
    }

    // --- Constructor ---
    constructor() {
        superAdmin = msg.sender;
        authorizedIssuers[msg.sender] = true;
        issuerList.push(msg.sender);
    }

    // --- Issuer Management ---
    function addIssuer(address wallet) external onlySuperAdmin {
        require(wallet != address(0), "Invalid address");
        require(!authorizedIssuers[wallet], "Already authorized");
        authorizedIssuers[wallet] = true;
        issuerList.push(wallet);
        emit IssuerAdded(wallet, block.timestamp);
    }

    function removeIssuer(address wallet) external onlySuperAdmin {
        require(authorizedIssuers[wallet], "Not authorized");
        authorizedIssuers[wallet] = false;
        emit IssuerRemoved(wallet, block.timestamp);
    }

    function isAuthorizedIssuer(address wallet) external view returns (bool) {
        return authorizedIssuers[wallet];
    }

    function getIssuerCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < issuerList.length; i++) {
            if (authorizedIssuers[issuerList[i]]) {
                count++;
            }
        }
        return count;
    }

    // --- Certificate Management ---
    function registerCertificate(
        string memory certificateId,
        bytes32 certificateHash,
        string memory ipfsCID,
        string memory certificateNumber
    ) external onlyAuthorizedIssuer {
        require(
            bytes(certificates[certificateId].ipfsCID).length == 0,
            "Certificate already exists"
        );
        require(
            certificateHash != bytes32(0),
            "Hash cannot be zero"
        );

        certificates[certificateId] = Certificate({
            certificateHash: certificateHash,
            issuerAddress: msg.sender,
            ipfsCID: ipfsCID,
            certificateNumber: certificateNumber,
            issueTimestamp: block.timestamp,
            status: 0
        });

        certificateIds.push(certificateId);

        emit CertificateRegistered(
            certificateId,
            certificateHash,
            msg.sender,
            block.timestamp
        );
    }

    function getCertificate(
        string memory certificateId
    )
        external
        view
        returns (
            bytes32 certificateHash,
            address issuerAddress,
            string memory ipfsCID,
            string memory certificateNumber,
            uint256 issueTimestamp,
            uint256 status
        )
    {
        Certificate storage cert = certificates[certificateId];
        require(
            bytes(cert.ipfsCID).length != 0,
            "Certificate not found"
        );

        return (
            cert.certificateHash,
            cert.issuerAddress,
            cert.ipfsCID,
            cert.certificateNumber,
            cert.issueTimestamp,
            cert.status
        );
    }

    function certificateExists(
        string memory certificateId
    ) external view returns (bool) {
        return bytes(certificates[certificateId].ipfsCID).length != 0;
    }

    function revokeCertificate(
        string memory certificateId
    ) external onlySuperAdmin {
        Certificate storage cert = certificates[certificateId];
        require(
            bytes(cert.ipfsCID).length != 0,
            "Certificate not found"
        );
        require(cert.status == 0, "Already revoked");

        cert.status = 1;
        emit CertificateRevoked(certificateId, block.timestamp);
    }

    function getCertificateStatus(
        string memory certificateId
    ) external view returns (uint256) {
        Certificate storage cert = certificates[certificateId];
        require(
            bytes(cert.ipfsCID).length != 0,
            "Certificate not found"
        );
        return cert.status;
    }

    function getCertificateCount() external view returns (uint256) {
        return certificateIds.length;
    }
}

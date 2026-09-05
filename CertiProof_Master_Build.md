# CERTIPROOF --- MASTER BUILD AGENT PROJECT SPECIFICATION

## Document Purpose

This document is the **single source of truth for the Build Agent**
working on the CertiProof final-year project.

The Build Agent must read and understand this document **before making
architectural, frontend, backend, blockchain, database, or UI changes**.

The goal is not to create a mockup or a static demonstration. The goal
is to build a **real, working, end-to-end blockchain-based academic
certificate issuance and verification platform** that can be
demonstrated live.

The implementation must prioritize:

1.  A working end-to-end certificate lifecycle.
2.  Real blockchain transactions on a Polygon test network.
3.  Real smart-contract interaction.
4.  Real cryptographic hashing.
5.  Real IPFS storage.
6.  Real QR-code-based verification.
7.  Real issuer authorization.
8.  A polished but simple modern frontend.
9.  Clear separation between development/test functionality and future
    production functionality.
10. No fake blockchain transaction data in the final demo.

------------------------------------------------------------------------

# 1. PROJECT IDENTITY

## Project Name

**CertiProof**

## Project Title

**Blockchain-Based Secure Certificate Verification**

## Project Type

Final-year academic project / web application / decentralized
certificate verification platform.

## Core Problem

Traditional academic certificate verification is often:

-   Slow
-   Manual
-   Dependent on contacting the issuing institution
-   Centralized
-   Vulnerable to document tampering
-   Difficult to scale across institutions
-   Difficult for employers or third parties to verify quickly

The project aims to create a trusted digital certificate ecosystem in
which authorized institutions can issue certificates and external
parties can independently verify their authenticity.

------------------------------------------------------------------------

# 2. CORE PROJECT IDEA

CertiProof allows an authorized educational institution to:

1.  Authenticate using MetaMask.
2.  Verify that its wallet is an authorized issuer.
3.  Enter student/certificate information.
4.  Generate a digital certificate.
5.  Generate a SHA-256 cryptographic hash for the certificate.
6.  Upload the certificate file to IPFS.
7.  Receive an IPFS Content Identifier (CID).
8.  Register certificate metadata and the cryptographic hash on a
    Polygon blockchain smart contract.
9.  Generate a unique QR code linked to the verification page.
10. Give/download the certificate containing the QR code.

A verifier/employer can then:

1.  Scan the QR code.
2.  Open CertiProof's public verification page.
3.  Retrieve the certificate record.
4.  Check whether the issuer is authorized.
5.  Retrieve the blockchain record.
6.  Retrieve the IPFS certificate where appropriate.
7.  Recalculate/compare the cryptographic hash.
8.  Confirm whether the certificate is authentic, invalid, revoked, or
    not found.
9.  View the relevant blockchain transaction details.

------------------------------------------------------------------------

# 3. IMPORTANT BLOCKCHAIN REQUIREMENT

## Polygon is the selected blockchain

The project will use the **Polygon ecosystem**.

For development and final academic demonstration, use a **Polygon test
network**, not real-money mainnet funds.

### Preferred demonstration network

**Polygon Amoy Testnet**

The native gas token on Polygon Amoy is **test POL**.

Important terminology:

-   Polygon's native token is now called **POL**.
-   Older documentation may refer to MATIC.
-   Do not design the application around MATIC terminology unless
    required for compatibility.
-   The project should display **POL** where appropriate.

### Critical rule

The Build Agent must never require the student to spend real
cryptocurrency for normal development or demonstration.

The project should be designed around testnet usage.

------------------------------------------------------------------------

# 4. REAL BLOCKCHAIN TRANSACTION REQUIREMENT

This is a critical project requirement.

The final Admin Portal must show **real live blockchain transaction
information**.

Do NOT create fake transaction hashes such as:

`0x123456...`

Do NOT use static transaction data.

Do NOT simulate "Blockchain Connected" with hardcoded values.

The application must interact with the Polygon Amoy blockchain.

When a transaction is sent:

1.  MetaMask must request confirmation.
2.  The user confirms the transaction.
3.  The transaction is broadcast to Polygon Amoy.
4.  The application obtains the real transaction hash.
5.  The UI shows the transaction as pending.
6.  The UI waits for confirmation where appropriate.
7.  The UI updates to confirmed/successful.
8.  The transaction hash must open the appropriate Polygon block
    explorer.
9.  The Admin Portal should display relevant live information.

------------------------------------------------------------------------

# 5. ADMIN PORTAL --- LIVE POL TRANSACTION FEATURE

The Admin Portal must contain a **Blockchain / Wallet / Transactions**
section.

At minimum it should display:

-   Connected wallet address
-   Network name
-   Network status
-   Current POL balance
-   Contract address
-   Recent blockchain transactions
-   Transaction hash
-   Transaction type
-   From address
-   To address
-   Value
-   Gas used / gas information when available
-   Block number
-   Confirmation status
-   Timestamp when available
-   Explorer link

## Required live transaction behavior

The project should support a real testnet POL transfer from the
connected administrative wallet to another wallet for
demonstration/testing.

Example:

``` text
Admin Wallet
0xAAA...
      |
      | 0.01 POL
      v
Test Wallet
0xBBB...
```

The transaction must be a genuine Polygon Amoy testnet transaction.

After MetaMask confirmation:

``` text
Transaction submitted
        |
        v
Pending
        |
        v
Polygon Amoy
        |
        v
Confirmed
        |
        v
Transaction Hash
        |
        v
Polygon Explorer
```

The Admin Portal should show this transaction in a transaction/activity
area.

### Important distinction

The POL transfer is primarily a **blockchain transaction demonstration
and wallet feature**.

The certificate system itself does not need to charge students or
employers POL.

POL is primarily used for:

-   Smart contract deployment
-   Smart contract transactions
-   Gas fees
-   Wallet testing
-   Demonstrating real blockchain activity

Certificate verification should not require the public verifier to own
POL.

------------------------------------------------------------------------

# 6. HIGH-LEVEL SYSTEM ARCHITECTURE

``` text
                         CERTIPROOF
                             |
             +---------------+---------------+
             |                               |
             v                               v
       ADMIN / ISSUER                    PUBLIC VERIFIER
             |                               |
         MetaMask                         QR Code
             |                               |
             v                               v
       Issuer Validation             Verification Page
             |                               |
             v                               |
     Certificate Form                       |
             |                               |
             v                               |
      Generate Certificate                  |
             |                               |
       +-----+------+                        |
       |            |                        |
       v            v                        |
    SHA-256       IPFS                       |
       |            |                        |
       |           CID                       |
       |            |                        |
       +-----+------+                        |
             |                               |
             v                               |
       Polygon Smart Contract <--------------+
             |
       +-----+------------------+
       |                        |
       v                        v
 Certificate Hash          Certificate Metadata
 Issuer Address             IPFS CID
 Certificate ID             Timestamp
 Status                     Issuer
```

------------------------------------------------------------------------

# 7. COMPLETE CERTIFICATE LIFECYCLE

``` text
AUTHORIZED ISSUER
       |
       v
Connect MetaMask
       |
       v
Check Issuer Authorization
       |
       v
Enter Student/Credential Data
       |
       v
Generate Certificate PDF
       |
       v
Generate SHA-256 Hash
       |
       v
Upload Certificate to IPFS
       |
       v
Receive IPFS CID
       |
       v
Register Certificate
on Polygon Smart Contract
       |
       v
Receive Real Transaction Hash
       |
       v
Generate QR Code
       |
       v
Attach QR to Certificate
       |
       v
Student receives certificate
       |
       v
Verifier scans QR
       |
       v
Public Verification Page
       |
       v
Fetch Blockchain Record
       |
       +-----------------------+
       |                       |
       v                       v
Validate Issuer          Compare Hash
       |                       |
       +-----------+-----------+
                   |
                   v
            Verification Result
                   |
          +--------+--------+
          |        |        |
          v        v        v
        VALID   INVALID   REVOKED
```

------------------------------------------------------------------------

# 8. USER ROLES

## 8.1 Super Admin

Responsible for platform-level management.

Capabilities:

-   Connect wallet
-   View platform dashboard
-   Add authorized issuers
-   Remove/deactivate issuers
-   View issuer list
-   View blockchain activity
-   View transaction history
-   Monitor smart-contract status
-   View system statistics

## 8.2 Authorized Issuer / University

Capabilities:

-   Connect MetaMask
-   Verify issuer authorization
-   Access issuer dashboard
-   Issue certificates
-   View issued certificates
-   View certificate status
-   View blockchain transaction
-   View IPFS CID
-   Generate/download certificate
-   Generate QR code
-   Optionally revoke certificates if revocation is implemented

## 8.3 Student / Certificate Holder

Initial version:

-   Receive/download certificate
-   Use QR code for verification
-   View certificate verification result

Future version may add:

-   Student account
-   Certificate wallet
-   Certificate sharing
-   Credential management
-   Download history
-   Selective sharing

## 8.4 Employer / Verifier

Must NOT need a blockchain wallet for normal verification.

Capabilities:

-   Scan QR
-   Search by certificate ID
-   Search by certificate number
-   View certificate verification result
-   View issuer information
-   View blockchain proof
-   View issue date
-   View certificate status

------------------------------------------------------------------------

# 9. FRONTEND PRODUCT VISION

The final product should look like a **real modern SaaS/Web3 product**,
not a student prototype.

Design principles:

-   Modern
-   Minimal
-   Clean
-   Professional
-   Gen-Z friendly
-   Glassy where appropriate
-   Smooth transitions
-   Good spacing
-   Strong typography
-   High readability
-   Responsive
-   Accessible
-   No unnecessary 3D effects
-   No excessive gradients
-   No visual clutter
-   No excessive animations

The visual language should communicate:

**Trust + Security + Technology + Simplicity**

Avoid:

-   Fake crypto-dashboard aesthetics
-   Excessive neon
-   Huge 3D blockchain graphics
-   Unnecessary spinning cubes
-   Excessive glass effects
-   Overloaded dashboards
-   Fake statistics

------------------------------------------------------------------------

# 10. PUBLIC LANDING PAGE

The landing page should clearly communicate:

## Hero

**Verify Academic Certificates in Seconds.**

Supporting message:

A blockchain-powered certificate verification platform that helps
institutions issue trusted digital credentials and allows employers to
verify them instantly.

Primary CTA:

**Verify a Certificate**

Secondary CTA:

**Issuer Login**

Possible visual:

A clean certificate card with:

-   Certificate ID
-   Verified badge
-   QR code
-   Blockchain status
-   Issuer information

------------------------------------------------------------------------

# 11. PUBLIC VERIFICATION PAGE

This is one of the most important pages.

URL concept:

``` text
/verify/:certificateId
```

The page should be accessible without MetaMask.

Example layout:

``` text
--------------------------------------------------
 CERTIPROOF

 Certificate Verification

        ✓
   CERTIFICATE VERIFIED

 Certificate ID
 CERT-2026-0001

 Student
 Example Student

 Degree
 B.Tech Computer Science

 Institution
 Example University

 Issued
 28 August 2026

 ------------------------------------------------
 Blockchain Proof

 Issuer        ✓ Authorized
 Hash Match    ✓ Verified
 Blockchain    ✓ Confirmed
 IPFS          ✓ Available

 Transaction
 0xabcdef....

 [View on Polygon Explorer]
--------------------------------------------------
```

The result states must be unambiguous.

Possible states:

### VERIFIED

Certificate exists, issuer is authorized, and the cryptographic proof
matches.

### INVALID

Certificate record is missing, hash does not match, or verification
fails.

### REVOKED

Certificate was previously valid but has been revoked by an authorized
issuer/admin.

### NOT FOUND

No matching certificate exists on the blockchain.

### UNAUTHORIZED ISSUER

The recorded issuer is not currently authorized.

------------------------------------------------------------------------

# 12. CERTIFICATE ISSUANCE PAGE

The issuer should have a clean form.

Suggested fields:

-   Student Name
-   Register Number
-   Student ID
-   Degree
-   Department
-   Institution
-   Academic Year
-   Certificate Number
-   Issue Date
-   Grade/CGPA where applicable
-   Additional credential information
-   Certificate template
-   Optional certificate file upload

The exact fields should be configurable rather than hardcoded into the
architecture.

------------------------------------------------------------------------

# 13. CERTIFICATE GENERATION

The system should create a professional digital certificate.

The certificate should contain:

-   Institution name/logo
-   Student name
-   Certificate title
-   Degree/credential
-   Department
-   Certificate number
-   Issue date
-   Issuer
-   Verification QR code
-   Verification URL or certificate ID
-   Optional blockchain verification reference

The certificate should not expose unnecessary private blockchain data.

------------------------------------------------------------------------

# 14. SHA-256 REQUIREMENT

SHA-256 is used as the cryptographic integrity mechanism.

Conceptually:

``` text
Certificate File
       |
       v
SHA-256
       |
       v
Certificate Hash
```

Example format:

``` text
a3f9...64 hexadecimal characters...
```

The actual hash must be calculated by the application.

Never hardcode example hashes into production functionality.

The hash must be reproducible.

If the exact certificate file changes, the resulting hash should change.

------------------------------------------------------------------------

# 15. IPFS REQUIREMENT

The actual certificate file should be stored using IPFS.

Flow:

``` text
Certificate PDF
      |
      v
IPFS Upload
      |
      v
CID
      |
      v
Polygon Smart Contract
```

The blockchain should store the CID/reference rather than unnecessarily
storing the entire PDF on-chain.

Benefits:

-   Lower on-chain storage requirements
-   Decentralized file reference
-   Content-addressed storage
-   Easy certificate retrieval

The application must handle IPFS upload failures gracefully.

------------------------------------------------------------------------

# 16. BLOCKCHAIN DATA MODEL

The smart contract should store only the information required for
trustworthy verification.

Suggested record:

``` text
Certificate {
    certificateId
    certificateHash
    studentIdentifier
    certificateNumber
    ipfsCID
    issuerAddress
    issueTimestamp
    status
}
```

Do not store unnecessary personally sensitive information on a public
blockchain.

Where possible, store:

-   Hashes
-   IDs
-   References
-   Public verification metadata

rather than:

-   Full private student records
-   Sensitive personal information
-   Complete certificate PDFs

------------------------------------------------------------------------

# 17. SMART CONTRACT RESPONSIBILITIES

The smart contract should support the certificate lifecycle.

Minimum conceptual functions:

``` solidity
registerCertificate(...)
getCertificate(...)
verifyCertificate(...)
isAuthorizedIssuer(...)
addIssuer(...)
removeIssuer(...)
```

If certificate revocation is included:

``` solidity
revokeCertificate(...)
```

The actual Solidity implementation may use mappings, structs, events,
modifiers, access control, or role-based permissions as appropriate.

------------------------------------------------------------------------

# 18. ISSUER AUTHORIZATION

Only authorized issuer wallets should be allowed to issue certificates.

Concept:

``` text
Issuer Wallet
     |
     v
Smart Contract
     |
     v
Authorized?
   /     \
 YES      NO
 |         |
 v         v
Issue     Reject
```

The authorization mechanism must be enforced by the smart contract.

Do not rely solely on frontend checks.

Frontend checks are useful for user experience, but blockchain
authorization must be enforced on-chain.

------------------------------------------------------------------------

# 19. SMART CONTRACT EVENTS

The contract should emit useful events.

For example:

``` text
CertificateIssued
IssuerAdded
IssuerRemoved
CertificateRevoked
```

Events should include enough information for the frontend to understand
what happened without exposing unnecessary sensitive information.

The frontend should listen for or retrieve relevant events where
practical.

------------------------------------------------------------------------

# 20. META MASK INTEGRATION

MetaMask is the wallet/authentication mechanism for administrative
blockchain interaction.

The frontend should allow:

``` text
Connect Wallet
      |
      v
Detect Address
      |
      v
Detect Network
      |
      v
Check Issuer Status
```

The UI should clearly show:

-   Connected wallet address
-   Shortened address
-   Network
-   Wallet connection state
-   Transaction state

Example:

``` text
0x83F...A21C
Polygon Amoy
● Connected
```

Never expose private keys.

Never ask users to enter seed phrases.

Never store private keys in frontend code.

------------------------------------------------------------------------

# 21. NETWORK HANDLING

The application should detect whether the user is connected to the
expected Polygon test network.

If the wrong network is selected:

``` text
Wrong Network

Please switch to Polygon Amoy
```

Provide a safe network-switch workflow if supported by the wallet
provider.

The application should not silently submit transactions to an unintended
network.

------------------------------------------------------------------------

# 22. ADMIN DASHBOARD

The Admin Portal should include:

## Dashboard

Cards:

-   Total Certificates
-   Verified Certificates
-   Invalid/Failed Verification
-   Authorized Issuers
-   Blockchain Transactions
-   Current POL Balance

## Quick Actions

-   Issue Certificate
-   Verify Certificate
-   Manage Issuers
-   Blockchain Transactions

## Recent Activity

Show real activity such as:

``` text
Certificate Issued
CERT-2026-0001
2 minutes ago

Certificate Verified
CERT-2026-0001
5 minutes ago

POL Transaction
0.01 POL
Confirmed
```

Do not display fake data if live data is available.

If sample/demo data is needed before backend integration, clearly
separate it from live data and remove/disable it for the final
production-like demo.

------------------------------------------------------------------------

# 23. BLOCKCHAIN TRANSACTION PAGE

This page is specifically required.

Display:

``` text
Blockchain Transactions

Network
Polygon Amoy

Wallet
0x123...456

Balance
12.48 POL

------------------------------------------

Transaction
0xabc...123

Type
Certificate Registration

From
0x123...456

To
0xcontract...789

Status
✓ Confirmed

Block
12345678

Gas
...

Value
0 POL

[View on Explorer]
```

For POL transfers:

``` text
Transaction
0xdef...999

Type
POL Transfer

From
0x123...

To
0x456...

Value
0.01 POL

Status
✓ Confirmed

[View on Explorer]
```

------------------------------------------------------------------------

# 24. REAL-TIME TRANSACTION UX

When a transaction begins:

``` text
Waiting for MetaMask confirmation...
```

After confirmation:

``` text
Transaction submitted
```

Then:

``` text
Confirming on Polygon...
```

Then:

``` text
✓ Transaction confirmed
```

Then display:

``` text
Transaction Hash
[0x...]
[View on Polygon Explorer]
```

Handle:

-   User rejection
-   Insufficient POL
-   Wrong network
-   RPC failure
-   Contract revert
-   Timeout
-   Connection failure

with understandable messages.

------------------------------------------------------------------------

# 25. CERTIFICATE VERIFICATION ALGORITHM

Conceptual workflow:

``` text
Input Certificate ID / QR
          |
          v
Fetch Blockchain Record
          |
          v
Does Record Exist?
     /           \
   NO             YES
   |               |
INVALID        Check Status
                   |
             +-----+-----+
             |           |
           Revoked     Active
             |           |
          REVOKED    Validate Issuer
                         |
                         v
                    Get Certificate
                         |
                         v
                    SHA-256 Hash
                         |
                         v
                  Compare Hashes
                     /       \
                  Match      Mismatch
                   |            |
                VERIFIED      INVALID
```

------------------------------------------------------------------------

# 26. QR CODE REQUIREMENT

Every certificate should receive a unique QR code.

The QR should point to a verification route such as:

``` text
https://your-domain/verify/CERT-2026-0001
```

Do not encode the entire certificate into the QR code.

Do not put private information into the QR code.

The QR should primarily contain:

-   Certificate ID
-   Secure verification URL
-   Or equivalent public verification reference

------------------------------------------------------------------------

# 27. TAMPER DETECTION

This is a critical demonstration.

### Original

``` text
Certificate PDF
      |
      v
SHA-256
      |
      v
HASH A
```

Blockchain stores HASH A.

If somebody modifies the PDF:

``` text
Modified Certificate PDF
      |
      v
SHA-256
      |
      v
HASH B
```

Since:

``` text
HASH A != HASH B
```

the system must display:

**Certificate Invalid / Tampered**

This is one of the main technical demonstrations of the project.

------------------------------------------------------------------------

# 28. DEMO SCENARIOS

The final application must support demonstration of at least these
scenarios.

## Scenario 1 --- Valid Certificate

``` text
Authorized Issuer
      |
      v
Issue
      |
      v
IPFS
      |
      v
Blockchain
      |
      v
QR
      |
      v
Verify
      |
      v
✓ VERIFIED
```

## Scenario 2 --- Tampered Certificate

Modify certificate data/file.

Expected:

``` text
✗ INVALID
Hash mismatch detected.
```

## Scenario 3 --- Unauthorized Issuer

Connect a wallet that is not authorized.

Expected:

``` text
✗ Unauthorized issuer.
Certificate issuance rejected.
```

This must be enforced by the smart contract.

## Scenario 4 --- Certificate Not Found

Enter random certificate ID.

Expected:

``` text
Certificate not found.
```

## Scenario 5 --- Revoked Certificate

If revocation is implemented:

``` text
Valid certificate
       |
       v
Revoke
       |
       v
Verify again
       |
       v
REVOKED
```

------------------------------------------------------------------------

# 29. FUTURE FEATURES

Do not unnecessarily implement every future feature in the first working
version.

Future roadmap:

## Phase 2

-   Certificate revocation
-   Certificate renewal
-   Issuer onboarding workflow
-   Multiple universities
-   Better role management
-   Certificate templates
-   Certificate sharing

## Phase 3

-   Student credential wallet
-   Verifiable credentials
-   Selective disclosure
-   Institution-to-institution verification
-   API for employers
-   Bulk certificate issuance
-   Bulk verification

## Phase 4

-   Multi-chain support
-   Layer-2 optimization
-   Advanced analytics
-   Institutional integrations
-   Mobile application
-   Enterprise deployment
-   Production-grade identity verification

## Possible advanced future features

-   DID/Decentralized Identity
-   W3C Verifiable Credentials
-   Zero-knowledge proofs for selective verification
-   Automated issuer onboarding
-   Audit analytics
-   Credential expiration
-   International credential interoperability

These are **future scope**, not mandatory MVP requirements.

------------------------------------------------------------------------

# 30. WHAT MUST NOT BE CLAIMED

The application and documentation must not claim that:

-   All academic fraud is permanently eliminated.
-   Blockchain makes the entire system completely unhackable.
-   Every university is automatically trusted.
-   A certificate is valid merely because a QR code exists.
-   The system uses real cryptocurrency payments unless actual payments
    are implemented.
-   The system is production-ready unless it has undergone appropriate
    production security review.
-   IPFS alone guarantees privacy.
-   A blockchain record proves that the underlying academic achievement
    was genuinely earned.

The system proves the integrity and authenticity of a certificate record
according to the issuing authority and registered blockchain data.

------------------------------------------------------------------------

# 31. SECURITY REQUIREMENTS

The Build Agent must follow secure development practices.

Never:

-   Hardcode private keys
-   Store seed phrases
-   Expose API secrets
-   Put privileged credentials in frontend source
-   Trust user-submitted issuer addresses
-   Allow arbitrary users to call privileged issuer functions
-   Store unnecessary sensitive student information on-chain
-   Hardcode transaction hashes
-   Fake successful blockchain responses

Use:

-   Environment variables
-   Smart-contract access control
-   Input validation
-   Transaction state handling
-   Secure RPC configuration
-   Safe frontend wallet interaction
-   Server-side protection for secrets where applicable

------------------------------------------------------------------------

# 32. ERROR HANDLING

Every major operation must have:

-   Loading state
-   Success state
-   Failure state
-   Retry capability where appropriate

Examples:

### IPFS failure

``` text
Certificate could not be uploaded.
Please try again.
```

### Wallet disconnected

``` text
Wallet disconnected.
Connect MetaMask to continue.
```

### Wrong network

``` text
Wrong network detected.
Switch to Polygon Amoy.
```

### Transaction rejected

``` text
Transaction rejected in MetaMask.
```

### Contract failure

``` text
Blockchain transaction failed.
Check the issuer authorization and wallet balance.
```

------------------------------------------------------------------------

# 33. DATABASE / OFF-CHAIN DATA

A conventional database may be used for non-blockchain application data
such as:

-   UI preferences
-   Audit display information
-   Non-critical metadata
-   Application users
-   Issuer profile information
-   Cached blockchain data
-   Analytics

However:

**The database must never become the source of truth for certificate
authenticity.**

The source of truth for blockchain certificate registration must remain
the smart contract.

------------------------------------------------------------------------

# 34. SOURCE OF TRUTH

For certificate verification:

### Blockchain

Source of truth for:

-   Certificate registration
-   Certificate hash
-   Issuer address
-   Certificate status
-   IPFS CID
-   Blockchain timestamp/transaction reference

### IPFS

Source of truth for:

-   Stored certificate file

### Frontend

Presentation layer only.

### Database

Optional supporting application layer.

------------------------------------------------------------------------

# 35. PROJECT TECHNOLOGY STACK

Preferred conceptual stack:

## Frontend

Modern React-based frontend or the existing project's frontend
framework.

Potential technologies:

-   React
-   TypeScript
-   Tailwind CSS
-   Modern component library
-   Ethers.js or viem
-   Wallet integration

The Build Agent must inspect the existing repository before replacing
technologies.

**Do not rewrite the entire project unnecessarily.**

## Blockchain

-   Polygon Amoy Testnet
-   Solidity
-   Ethereum-compatible smart contract tooling
-   MetaMask
-   Polygon-compatible RPC
-   Polygon block explorer

## Storage

-   IPFS
-   Pinning/provider service as required

## Cryptography

-   SHA-256

## QR

-   QR-code generation library

## Certificate

-   PDF generation library appropriate to the existing application
    architecture

------------------------------------------------------------------------

# 36. DEVELOPMENT STRATEGY

Do not attempt to build the entire application at once.

Build in this order:

## STEP 1 --- Inspect Existing Project

Before modifying anything:

-   Inspect repository
-   Inspect package.json
-   Inspect frontend structure
-   Inspect backend structure
-   Inspect existing routes
-   Inspect existing components
-   Inspect environment configuration
-   Identify what is already working
-   Identify broken functionality
-   Avoid deleting working functionality

Create a clear implementation plan.

## STEP 2 --- Blockchain Foundation

Implement:

-   Polygon Amoy connection
-   MetaMask connection
-   Network detection
-   Wallet address display
-   POL balance display

## STEP 3 --- Smart Contract

Implement:

-   Issuer authorization
-   Certificate registration
-   Certificate lookup
-   Certificate verification
-   Events
-   Optional revocation

Deploy to Polygon Amoy.

Record:

-   Contract address
-   Network
-   Deployment transaction hash

## STEP 4 --- Certificate Issuance

Implement:

-   Form
-   Certificate generation
-   SHA-256
-   IPFS upload
-   Smart contract registration
-   Transaction confirmation
-   QR generation

## STEP 5 --- Verification

Implement:

-   QR route
-   Certificate lookup
-   Hash comparison
-   Issuer validation
-   Status validation
-   Result page

## STEP 6 --- Admin Blockchain Activity

Implement:

-   POL balance
-   Real POL transfer
-   Real transaction status
-   Transaction history
-   Explorer links

## STEP 7 --- Testing

Test all required scenarios.

## STEP 8 --- UI Polish

Only after the functionality works:

-   Improve spacing
-   Improve typography
-   Add transitions
-   Improve responsive layout
-   Improve error states
-   Improve empty states

------------------------------------------------------------------------

# 37. DEFINITION OF MVP COMPLETE

The MVP is complete only when this exact flow works:

``` text
1. Admin connects MetaMask
        |
2. Polygon Amoy detected
        |
3. Admin wallet is recognized
        |
4. Issuer authorization is checked
        |
5. Admin creates certificate
        |
6. Certificate file is generated
        |
7. SHA-256 hash is generated
        |
8. Certificate is uploaded to IPFS
        |
9. CID is returned
        |
10. Smart contract transaction is requested
        |
11. MetaMask confirmation appears
        |
12. Real Polygon Amoy transaction is mined
        |
13. Real transaction hash is displayed
        |
14. Certificate record exists on-chain
        |
15. QR code is generated
        |
16. Verifier scans QR
        |
17. Public verification page opens
        |
18. Blockchain record is retrieved
        |
19. Issuer is validated
        |
20. Hash is verified
        |
21. Certificate displays VERIFIED
```

Then the tampering test must work:

``` text
Modify certificate
       |
       v
Verify
       |
       v
Hash mismatch
       |
       v
INVALID / TAMPERED
```

------------------------------------------------------------------------

# 38. ADMIN LIVE POL DEMONSTRATION

The final project demo should also include:

``` text
Admin Dashboard
       |
       v
Blockchain / Wallet
       |
       +---- Wallet Address
       |
       +---- Polygon Amoy
       |
       +---- POL Balance
       |
       +---- Send POL
       |
       +---- Transaction Activity
```

Example:

``` text
Send Test POL

Recipient
[0x........................]

Amount
[0.01]

[Send POL]
```

Then:

``` text
MetaMask
Confirm transaction
        |
        v
Polygon Amoy
        |
        v
Transaction confirmed
        |
        v
Admin Portal

✓ 0.01 POL sent
Transaction:
0xabc123...
```

The transaction must be real.

The recipient wallet must actually receive the test POL.

------------------------------------------------------------------------

# 39. CERTIFICATE TRANSACTION DEMONSTRATION

Issuing a certificate should also create a real blockchain transaction.

Example:

``` text
Certificate Registration

Certificate:
CERT-2026-0001

Hash:
a8c...

IPFS CID:
bafy...

Issuer:
0x123...

Transaction:
0x456...

Status:
✓ Confirmed
```

The transaction should be visible on the Polygon block explorer.

------------------------------------------------------------------------

# 40. UI STATUS SYSTEM

Use clear visual status labels.

### Green / positive state

-   Verified
-   Confirmed
-   Authorized
-   Connected
-   Active

### Warning state

-   Pending
-   Waiting for confirmation
-   Wrong network
-   Low POL balance

### Error state

-   Invalid
-   Rejected
-   Revoked
-   Unauthorized
-   Not found
-   Hash mismatch

Do not rely only on color; include text/icons for accessibility.

------------------------------------------------------------------------

# 41. RESPONSIVE DESIGN

The application must work on:

-   Desktop
-   Laptop
-   Tablet
-   Mobile

Public verification must especially work well on mobile because users
may scan QR codes using phones.

Admin dashboard can prioritize desktop but should remain responsive.

------------------------------------------------------------------------

# 42. PERFORMANCE REQUIREMENTS

The application should:

-   Avoid unnecessary blockchain requests
-   Cache safe read-only data where appropriate
-   Avoid storing certificate PDFs directly on-chain
-   Show loading states
-   Avoid blocking the entire UI during transactions
-   Handle asynchronous blockchain operations correctly

Do not make unrealistic performance claims.

The final project can measure:

-   Certificate issuance time
-   IPFS upload time
-   Blockchain confirmation time
-   Verification lookup time
-   Traditional/manual verification comparison

------------------------------------------------------------------------

# 43. TESTING REQUIREMENTS

## Functional testing

Test:

-   Wallet connection
-   Network detection
-   Issuer authorization
-   Certificate creation
-   SHA-256 generation
-   IPFS upload
-   Contract registration
-   QR generation
-   QR verification
-   Hash matching
-   Invalid certificate
-   Unauthorized issuer
-   Non-existent certificate
-   POL transfer

## Blockchain testing

Verify:

-   Real contract address
-   Real transaction hash
-   Real block confirmation
-   Real POL balance
-   Real POL transfer
-   Contract state updates

## Security testing

Test:

-   Unauthorized issuer
-   Modified certificate
-   Invalid certificate ID
-   Wrong wallet
-   Wrong network
-   Transaction rejection
-   Invalid inputs

------------------------------------------------------------------------

# 44. ACCEPTANCE CRITERIA

The project passes the basic acceptance test if:

### Blockchain

-   [ ] Polygon Amoy connected
-   [ ] MetaMask connected
-   [ ] POL balance displayed
-   [ ] Smart contract deployed
-   [ ] Contract address displayed
-   [ ] Real transactions work

### Issuance

-   [ ] Authorized issuer can issue
-   [ ] Unauthorized wallet cannot issue
-   [ ] Certificate generated
-   [ ] SHA-256 generated
-   [ ] IPFS CID generated
-   [ ] Blockchain record created
-   [ ] Transaction hash displayed
-   [ ] QR generated

### Verification

-   [ ] QR opens verification page
-   [ ] Certificate is found
-   [ ] Issuer validated
-   [ ] Hash validated
-   [ ] Valid certificate shows VERIFIED
-   [ ] Tampered certificate shows INVALID
-   [ ] Unknown certificate shows NOT FOUND

### Admin

-   [ ] Wallet displayed
-   [ ] POL balance displayed
-   [ ] Real POL transfer works
-   [ ] Transaction activity displayed
-   [ ] Explorer link works

------------------------------------------------------------------------

# 45. WHAT TO DO IF SOMETHING IS ALREADY IMPLEMENTED

The Build Agent must not blindly rebuild existing features.

First determine:

``` text
Existing feature
      |
      +--> Working?
      |       |
      |      YES --> Preserve and integrate
      |
      +--> Partially working?
      |       |
      |      YES --> Repair/refactor
      |
      +--> Broken?
      |       |
      |      YES --> Fix
      |
      +--> Missing?
              |
             YES --> Build
```

Before replacing an existing component, explain:

-   What is wrong
-   Why replacement is necessary
-   What will remain compatible

------------------------------------------------------------------------

# 46. AGENT WORKING RULES

The Build Agent must:

1.  Inspect before changing.
2.  Build incrementally.
3.  Keep the application runnable after each major change.
4.  Avoid unnecessary rewrites.
5.  Keep secrets out of source control.
6.  Use environment variables.
7.  Use real blockchain calls for blockchain functionality.
8.  Never fake transaction hashes.
9.  Never fake certificate verification.
10. Never claim an operation succeeded before the underlying operation
    actually succeeded.
11. Handle pending transactions correctly.
12. Keep the public verifier wallet-free.
13. Keep certificate authenticity dependent on blockchain verification
    rather than a normal database.
14. Keep the architecture understandable enough for an academic project
    presentation.
15. Document setup and deployment steps.
16. Maintain a clear `.env.example`.
17. Maintain contract ABI/address configuration cleanly.
18. Keep development and production configuration separate.

------------------------------------------------------------------------

# 47. DEVELOPMENT VS FINAL DEMO

## Local development

A local blockchain such as Hardhat/Anvil may be used for rapid
development and debugging.

Advantages:

-   Free
-   Fast
-   Easy resets
-   Unlimited local test accounts

## Public academic demonstration

Use:

**Polygon Amoy Testnet**

This provides:

-   Real public blockchain transactions
-   Real transaction hashes
-   Real block confirmations
-   MetaMask interaction
-   Public explorer verification
-   Test POL with no real-world monetary value

The final demonstration should preferably show a real Polygon Amoy
transaction.

------------------------------------------------------------------------

# 48. DO NOT CONFUSE TEST POL WITH REAL MONEY

The system is an academic testnet project.

Use test POL for:

-   Gas
-   Contract deployment
-   Certificate registration transactions
-   Demonstration transfers

Do not design the system as a financial application.

Do not implement token trading.

Do not implement speculative cryptocurrency functionality.

The blockchain is being used primarily as a **trusted integrity and
verification infrastructure**.

------------------------------------------------------------------------

# 49. FINAL PRODUCT EXPERIENCE

A person seeing the final project should understand it within a few
seconds.

### Admin sees:

``` text
CertiProof
Blockchain-backed certificate management

Connected
Polygon Amoy
12.48 POL

[Issue Certificate]

Recent Blockchain Activity
✓ Certificate Registered
✓ POL Transfer
✓ Issuer Added
```

### Student receives:

``` text
Official Digital Certificate

Student Name
B.Tech Computer Science

Certificate ID
CERT-2026-0001

[QR CODE]

Scan to verify
```

### Employer scans:

``` text
CERTIPROOF

✓ CERTIFICATE VERIFIED

Student:
Example Student

Degree:
B.Tech Computer Science

Institution:
Example University

Blockchain Proof:
✓ Hash Match
✓ Authorized Issuer
✓ Blockchain Record Found

[View Blockchain Transaction]
```

### Tampered certificate:

``` text
✗ CERTIFICATE INVALID

The certificate data does not
match the registered blockchain
hash.

Hash mismatch detected.
```

This is the experience the final product must deliver.

------------------------------------------------------------------------

# 50. FUTURE-PROOF ARCHITECTURE

Build the application so that future features can be added without
rewriting the entire system.

Potential future additions:

``` text
                    CERTIPROOF
                        |
          +-------------+-------------+
          |             |             |
       Academic      Skills       Professional
       Certificates  Credentials   Credentials
          |             |             |
          +-------------+-------------+
                        |
                Verifiable Credentials
                        |
              +---------+---------+
              |                   |
          Blockchain             IPFS
              |
       Decentralized Identity
              |
        Multi-institution
              |
          Global ecosystem
```

The current MVP should remain simple while leaving clear extension
points.

------------------------------------------------------------------------

# 51. RESEARCH ALIGNMENT

The project is based on the research direction identified in the
literature review:

-   Blockchain for academic credentials
-   Credential authenticity
-   Tamper resistance
-   Decentralized verification
-   Smart contracts
-   Issuer validation
-   Certificate lifecycle management
-   Secure document management
-   Improved verification efficiency

The research material also identifies limitations in existing systems
involving scalability, institutional integration, issuer validation,
privacy, usability, and practical deployment.

The project should therefore emphasize:

**Secure issuance + issuer authorization + cryptographic integrity +
decentralized storage + instant public verification.**

------------------------------------------------------------------------

# 52. FINAL PROJECT STORY FOR DEMONSTRATION

The project should be explainable in one short story:

> A university connects its authorized MetaMask wallet to CertiProof and
> issues a digital certificate. The certificate is hashed using SHA-256
> and stored in IPFS, while the hash, certificate reference, issuer
> information, and status are registered through a Polygon smart
> contract. A QR code is generated for the certificate. When an employer
> scans the QR code, CertiProof retrieves the blockchain record and
> checks the issuer and certificate hash. If everything matches, the
> certificate is verified. If the certificate has been modified, the
> hash changes and the system detects the tampering. The admin portal
> also displays real Polygon testnet transactions and POL activity.

------------------------------------------------------------------------

# 53. FINAL BUILD PRIORITY

The Build Agent must prioritize in this exact order:

### PRIORITY 1

**Working Polygon + MetaMask connection**

### PRIORITY 2

**Working issuer authorization smart contract**

### PRIORITY 3

**Working certificate registration smart contract**

### PRIORITY 4

**Working SHA-256 generation**

### PRIORITY 5

**Working IPFS upload**

### PRIORITY 6

**Working certificate generation**

### PRIORITY 7

**Working QR generation**

### PRIORITY 8

**Working public verification**

### PRIORITY 9

**Hash/tamper detection**

### PRIORITY 10

**Real POL transaction in Admin Portal**

### PRIORITY 11

**Transaction history and explorer links**

### PRIORITY 12

**UI polish and final presentation**

Do not prioritize animations or visual polish above core functionality.

------------------------------------------------------------------------

# 54. DEFINITION OF DONE

The project is considered genuinely complete when a reviewer can sit in
front of the application and observe:

``` text
                    START
                      |
                      v
              Connect MetaMask
                      |
                      v
              Polygon Amoy
                      |
                      v
              Authorized Issuer
                      |
                      v
             Create Certificate
                      |
                      v
               Generate PDF
                      |
                      v
                  SHA-256
                      |
                      v
                    IPFS
                      |
                      v
              Smart Contract
                      |
                      v
          REAL POLYGON TRANSACTION
                      |
                      v
                 QR CODE
                      |
                      v
                 SCAN QR
                      |
                      v
             PUBLIC VERIFICATION
                      |
                      v
               HASH MATCH
                      |
                      v
               ISSUER VALID
                      |
                      v
              ✓ VERIFIED
```

Then the reviewer can modify the certificate and see:

``` text
HASH MISMATCH
     |
     v
✗ INVALID / TAMPERED
```

And the reviewer can open the Admin Portal and see:

``` text
Polygon Amoy
Wallet Address
POL Balance
Real Transaction Hash
Transaction Status
Block Number
Explorer Link
```

If these workflows work with real data, the project has achieved its
core objective.

------------------------------------------------------------------------

# 55. FINAL INSTRUCTION TO THE BUILD AGENT

**Build CertiProof as a real working blockchain application, not as a
visual simulation.**

The most important requirement is the complete integration of:

**MetaMask → Polygon Amoy → Smart Contract → SHA-256 → IPFS → QR →
Verification**

with:

**real on-chain transactions**

and:

**real test POL activity visible in the Admin Portal.**

Keep the architecture simple enough to explain during a final-year
project review, but implement the blockchain interactions genuinely.

Whenever there is a choice between:

-   fake data vs real data → use real data
-   simulated transaction vs real transaction → use real transaction
-   hardcoded verification vs blockchain verification → use blockchain
    verification
-   unnecessary feature vs core functionality → prioritize core
    functionality
-   visual complexity vs usability → prioritize usability

The final application must feel like a credible early-stage production
product while remaining appropriate for a final-year academic project.

**Build the working system first. Polish it second.**

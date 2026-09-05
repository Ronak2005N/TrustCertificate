# CertiProof — Complete Build Plan

## Status: Planning Complete → Ready to Build

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│  Existing UI + MetaMask + ethers.js + QR + Real SHA-256 │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
           ▼                          ▼
┌─────────────────────┐  ┌───────────────────────────────┐
│  SMART CONTRACT     │  │  SERVER FUNCTIONS (Nitro)      │
│  Polygon Amoy       │  │  Pinata IPFS upload (secret)   │
│  Hardhat + Solidity │  │  TanStack Start createServerFn │
└─────────────────────┘  └───────────────────────────────┘
```

---

## Build Phases

### PHASE 0 — Environment Setup
**Goal:** Get MetaMask working with Polygon Amoy and test POL

**Steps:**
1. Guide user to install MetaMask browser extension
2. Add Polygon Amoy testnet to MetaMask (chainId 80002)
3. Get test POL from Polygon faucet (https://faucet.polygon.technology/)
4. Create a `.env` file with Pinata API keys (user needs to create Pinata account)
5. Add `.env` to `.gitignore`
6. Install npm dependencies: `ethers`, `hardhat`, `@nomicfoundation/hardhat-toolbox`, `pinata`

**Deliverable:** User has MetaMask + Polygon Amoy + test POL + Pinata account

---

### PHASE 1 — Smart Contract
**Goal:** Write, test, and deploy the CertChainRegistry contract

**File:** `contracts/CertChainRegistry.sol`

```solidity
// Core functions:
- addIssuer(address wallet)           // Super Admin only
- removeIssuer(address wallet)        // Super Admin only
- isAuthorizedIssuer(address wallet)  // Public view
- registerCertificate(
    string certificateId,
    bytes32 certificateHash,
    string ipfsCID,
    string certificateNumber
  )                                   // Authorized Issuers only
- getCertificate(string certificateId) // Public view
- revokeCertificate(string certificateId) // Super Admin only
- getIssuerCount()                    // Public view
- getTransactionHistory()             // Admin view
```

**File:** `hardhat.config.ts`

**File:** `scripts/deploy.ts`

**File:** `test/CertChainRegistry.test.ts`

**Data model on-chain:**
```solidity
struct Certificate {
    bytes32 certificateHash;    // SHA-256 of certificate
    address issuerAddress;      // Who issued it
    string ipfsCID;             // IPFS reference
    string certificateNumber;   // Human-readable number
    uint256 issueTimestamp;     // When issued
    uint256 status;             // 0=Active, 1=Revoked
}

mapping(string => Certificate) public certificates;  // certificateId => record
mapping(address => bool) public authorizedIssuers;   // wallet => authorized
address public superAdmin;                            // Deployer = Super Admin
```

**Events:**
```solidity
event IssuerAdded(address indexed issuer, uint256 timestamp);
event IssuerRemoved(address indexed issuer, uint256 timestamp);
event CertificateRegistered(string indexed certificateId, bytes32 indexed hash, address indexed issuer, uint256 timestamp);
event CertificateRevoked(string indexed certificateId, uint256 timestamp);
```

**Deploy to Polygon Amoy, record:**
- Contract address
- Deployment transaction hash
- ABI file

**Deliverable:** Smart contract live on Polygon Amoy

---

### PHASE 2 — Server-Side Pinata Proxy
**Goal:** Keep Pinata keys secret by routing uploads through server functions

**File:** `src/lib/server/upload-to-ipfs.ts`

```typescript
// TanStack Start server function
// Reads PINATA_JWT from env (server-side only)
// Receives: file Blob/Buffer
// Returns: { cid: string, url: string }
```

**File:** `src/lib/server/pinata-config.ts`

```typescript
// Server-side Pinata configuration
// PINATA_API_KEY, PINATA_SECRET_KEY from process.env
```

**TanStack Start pattern:**
```typescript
import { createServerFn } from "@tanstack/react-start";

export const uploadToIPFS = createServerFn({ method: "POST" })
  .validator((file: File) => file)
  .handler(async ({ data }) => {
    // Pinata upload logic here (server-side only)
    // PINATA_JWT is never exposed to frontend
  });
```

**Deliverable:** Server function that uploads to IPFS and returns CID

---

### PHASE 3 — Frontend Blockchain Layer
**Goal:** MetaMask connection, contract interaction, real SHA-256

**File:** `src/lib/blockchain/contracts.ts`
```typescript
// Contract ABI import
// Contract address (from .env or config)
// Network config (Polygon Amoy: chainId 80002)
```

**File:** `src/lib/blockchain/metamask.ts`
```typescript
// connectWallet() - requests MetaMask accounts
// getProvider() - returns ethers.BrowserProvider
// getSigner() - returns ethers.Signer
// getContract() - returns contract instance with signer
// switchToAmoy() - prompts network switch
// getBalance() - returns POL balance
```

**File:** `src/lib/blockchain/verify.ts`
```typescript
// verifyOnChain(certId) - reads blockchain record
// compareHash(local, onChain) - compares SHA-256 hashes
// checkIssuerAuth(wallet) - checks on-chain authorization
```

**File:** `src/lib/blockchain/types.ts`
```typescript
// OnChainCertificate, WalletState, NetworkInfo
```

**File:** `src/lib/hooks/useWallet.tsx`
```typescript
// React context + hook for wallet state
// Provides: address, chainId, balance, provider, signer
// Auto-reconnects on page load if previously connected
```

**File:** `src/lib/hooks/useContract.tsx`
```typescript
// Hook that returns contract read/write methods
// Depends on wallet context
```

**Real SHA-256:**
```typescript
// src/lib/crypto.ts
// Uses Web Crypto API: crypto.subtle.digest("SHA-256", buffer)
// Takes certificate file or structured data → returns hex hash
```

**Dependencies to install:**
- `ethers` (v6)
- `qrcode` (already installed)

**Deliverable:** Frontend can connect MetaMask, read/write contract, compute real SHA-256

---

### PHASE 4 — Wire Certificate Issuance to Real Blockchain
**Goal:** Issue a certificate → real blockchain transaction

**Modify:** `src/lib/certiproof.ts` → rename to `src/lib/certificates.ts`

**New flow:**
```
1. User fills form (existing UI)
2. Generate certificate PDF (new - use jsPDF or @react-pdf/renderer)
3. Compute SHA-256 of PDF (real crypto)
4. Upload PDF to IPFS via server function → get CID
5. Call smart contract registerCertificate() via MetaMask
6. MetaMask popup → user confirms
7. Wait for transaction confirmation
8. Display real transaction hash, block number
9. Generate QR code pointing to /verify/$certificateId
```

**File:** `src/lib/pdf/generate-certificate.ts`
```typescript
// Generates PDF certificate
// Includes: student name, course, institution, date, QR code
// Uses jsPDF or @react-pdf/renderer
```

**Modify existing components:**
- `src/routes/issue.tsx` — wire to real flow
- `src/components/common/ProgressSteps.tsx` — use real stages
- `src/components/certificate/CertificatePreview.tsx` — keep as-is

**Deliverable:** Real certificate issuance with blockchain + IPFS + PDF + SHA-256

---

### PHASE 5 — Public Verification from Blockchain
**Goal:** Verifier scans QR → reads directly from blockchain → shows result

**Modify:** `src/routes/verify_.$hash.tsx`

**New flow:**
```
1. User arrives at /verify/:certificateId (or /verify/:hash)
2. Read certificate record from smart contract (public, no wallet needed)
3. If not found → NOT FOUND
4. If found, check status → REVOKED if revoked
5. If active, verify issuer is authorized
6. Fetch certificate from IPFS using CID (display or compare)
7. Compare hashes
8. Display: VERIFIED / INVALID / REVOKED / NOT FOUND / UNAUTHORIZED ISSUER
```

**Modify:** `src/components/verify/VerificationResult.tsx` — show blockchain data
**Modify:** `src/components/verify/VerificationLoader.tsx` — real loading states

**Deliverable:** Real public verification against blockchain

---

### PHASE 6 — QR Code Generation
**Goal:** Every issued certificate gets a QR code linking to verification URL

**File:** Update `src/components/common/QRCodeCard.tsx`
```typescript
// Generates QR code for: https://certiproof.app/verify/{certificateId}
// Uses existing `qrcode` library
// Already partially built, needs wiring
```

**Modify:** `src/routes/certificate.$id.tsx` — display QR code
**Modify:** Certificate PDF generation — embed QR in PDF

**Deliverable:** QR codes on certificates pointing to real verification URLs

---

### PHASE 7 — Admin Blockchain Features
**Goal:** Real POL balance, transaction history, POL transfer demo

**New route:** `src/routes/dashboard.blockchain.tsx`
```
- Wallet connection status
- Connected address (shortened)
- Network: Polygon Amoy
- POL balance (real, from provider)
- Contract address
- Send test POL form (recipient + amount)
- Real POL transfer via MetaMask
- Transaction history (from events or provider)
- Explorer links for each transaction
```

**New component:** `src/components/dashboard/WalletPanel.tsx`
**New component:** `src/components/dashboard/TransactionHistory.tsx`
**New component:** `src/components/dashboard/PolTransfer.tsx`

**Modify:** `src/components/layout/DashboardShell.tsx` — add "Blockchain" nav item
**Modify:** `src/routes/dashboard.tsx` — add blockchain section to nav

**Deliverable:** Live POL balance, real POL transfer, transaction history

---

### PHASE 8 — Issuer Management (Super Admin)
**Goal:** Super Admin can add/remove authorized issuers on-chain

**New route:** `src/routes/dashboard.issuers.tsx`
```
- List authorized issuers (from contract events or mapping)
- Add issuer form (wallet address + institution name)
- Remove issuer button
- All operations are real blockchain transactions
```

**New component:** `src/components/dashboard/IssuerManager.tsx`

**Modify:** Dashboard nav — add "Issuers" link

**Deliverable:** On-chain issuer authorization management

---

### PHASE 9 — Login + Auth Wiring
**Goal:** MetaMask-based authentication instead of fake email/password

**Modify:** `src/routes/login.tsx`
```
- Replace email/password with "Connect MetaMask" button
- Check if connected wallet is Super Admin or Authorized Issuer
- If authorized → redirect to dashboard
- If not → show "Unauthorized issuer" message
```

**Deliverable:** Wallet-based authentication

---

### PHASE 10 — Settings + Configuration
**Goal:** Real settings that read from blockchain

**Modify:** `src/routes/settings.tsx`
```
- Organization tab: read from contract events or config
- Blockchain tab: show real contract address, network, deployer wallet
- Remove fake toggles, replace with real config
```

**Deliverable:** Settings reflect real blockchain state

---

### PHASE 11 — Error Handling + Edge Cases
**Goal:** Handle all failure modes gracefully

**Cover:**
- MetaMask not installed → "Install MetaMask" message
- Wrong network → "Switch to Polygon Amoy" with button
- Insufficient POL → "Insufficient POL for gas"
- Transaction rejected → "Transaction rejected in MetaMask"
- IPFS upload failed → "Certificate upload failed, please retry"
- Contract revert → "Blockchain transaction failed"
- Wallet disconnected → "Wallet disconnected, reconnect to continue"
- Network timeout → "Network timeout, check connection"

**Deliverable:** Robust error handling throughout

---

### PHASE 12 — Tamper Detection Demo
**Goal:** Demonstrate hash mismatch when certificate is modified

**Modify:** `src/routes/verify.tsx` (Method C — document upload)
```
- Upload a certificate PDF
- Compute SHA-256 of uploaded file
- Fetch registered hash from blockchain
- Compare → MATCH (verified) or MISMATCH (tampered)
- Currently uses filename heuristic → replace with real crypto
```

**Deliverable:** Real tamper detection using SHA-256 comparison

---

### PHASE 13 — UI Polish + Final Review
**Goal:** Match master spec design principles

- Verify responsive on mobile (especially verification page)
- Check all status labels match spec (green/warning/error)
- Verify explorer links work
- Test complete demo flow end-to-end
- Remove any remaining mock data

**Deliverable:** Production-quality UI

---

## File Structure After Build

```
Trust Certificates/
├── contracts/
│   └── CertChainRegistry.sol          # Solidity contract
├── scripts/
│   └── deploy.ts                       # Deployment script
├── test/
│   └── CertChainRegistry.test.ts       # Contract tests
├── hardhat.config.ts                    # Hardhat config
├── src/
│   ├── lib/
│   │   ├── blockchain/
│   │   │   ├── contracts.ts            # ABI + address
│   │   │   ├── metamask.ts             # Wallet connection
│   │   │   ├── verify.ts               # On-chain verification
│   │   │   └── types.ts                # Blockchain types
│   │   ├── server/
│   │   │   ├── upload-to-ipfs.ts       # Pinata server function
│   │   │   └── pinata-config.ts        # Server-side config
│   │   ├── crypto.ts                    # Real SHA-256
│   │   ├── pdf/
│   │   │   └── generate-certificate.ts  # PDF generation
│   │   ├── types.ts                     # App types (updated)
│   │   └── certificates.ts             # Certificate logic (replaces certiproof.ts)
│   ├── hooks/
│   │   ├── useWallet.tsx               # Wallet context
│   │   └── useContract.tsx             # Contract hook
│   ├── routes/
│   │   ├── dashboard.blockchain.tsx    # NEW: blockchain activity
│   │   ├── dashboard.issuers.tsx       # NEW: issuer management
│   │   └── (existing routes updated)
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── WalletPanel.tsx         # NEW
│   │   │   ├── TransactionHistory.tsx  # NEW
│   │   │   ├── PolTransfer.tsx         # NEW
│   │   │   └── IssuerManager.tsx       # NEW
│   │   └── (existing components updated)
│   └── (existing structure preserved)
├── .env                                 # Secrets (gitignored)
├── .env.example                         # Template
└── (existing config files)
```

---

## Dependencies to Install

**Frontend:**
- `ethers` — blockchain interaction
- `jsPDF` or `@react-pdf/renderer` — PDF generation
- `qrcode` — already installed ✓

**Dev/Blockchain:**
- `hardhat` — development environment
- `@nomicfoundation/hardhat-toolbox` — Hardhat plugins
- `@nomicfoundation/hardhat-ethers` — ethers integration
- `solidity-coverage` — test coverage
- `dotenv` — env variables for Hardhat

**Server:**
- `pinata-sdk` or raw HTTP to Pinata API

---

## Environment Variables (.env)

```bash
# Pinata (server-side only)
PINATA_API_KEY=your_key
PINATA_SECRET_KEY=your_secret
PINATA_JWT=your_jwt

# Smart contract (after deployment)
VITE_CONTRACT_ADDRESS=0x...
VITE_CHAIN_ID=80002
VITE_NETWORK_NAME=Polygon Amoy
VITE_EXPLORER_URL=https://amoy.polygonscan.com

# App config
VITE_APP_URL=http://localhost:8080
```

---

## Build Order (Priority per Master Spec)

| Priority | Phase | What | Status |
|----------|-------|------|--------|
| 1 | Phase 0 | MetaMask + Polygon Amoy + test POL | NEXT |
| 2 | Phase 1 | Smart Contract | PENDING |
| 3 | Phase 3 | Frontend Blockchain Layer | PENDING |
| 4 | Phase 4 | Certificate Issuance (real) | PENDING |
| 5 | Phase 5 | Public Verification (real) | PENDING |
| 6 | Phase 2 | Pinata IPFS (server proxy) | PENDING |
| 7 | Phase 6 | QR Code Generation | PENDING |
| 8 | Phase 7 | Admin POL Transaction Demo | PENDING |
| 9 | Phase 8 | Issuer Management | PENDING |
| 10 | Phase 9 | Login + Auth | PENDING |
| 11 | Phase 10 | Settings | PENDING |
| 12 | Phase 11 | Error Handling | PENDING |
| 13 | Phase 12 | Tamper Detection | PENDING |
| 14 | Phase 13 | UI Polish | PENDING |

---

## Demo Scenarios (per Master Spec)

### Scenario 1: Valid Certificate ✅
```
Connect MetaMask (Polygon Amoy)
  → Authorized Issuer check (on-chain)
  → Fill form → Generate PDF → SHA-256 → IPFS → Smart Contract
  → Real transaction hash
  → QR code generated
  → Employer scans QR → /verify/CERT-2026-XXXX
  → Blockchain record fetched
  → Hash match → Issuer valid → ✓ VERIFIED
```

### Scenario 2: Tampered Certificate ✗
```
Upload modified certificate PDF
  → SHA-256 computed
  → Compared with blockchain hash
  → Hash mismatch → ✗ INVALID / TAMPERED
```

### Scenario 3: Unauthorized Issuer ✗
```
Connect non-authorized wallet
  → Attempt to issue certificate
  → Smart contract rejects (on-chain enforcement)
  → ✗ Unauthorized issuer
```

### Scenario 4: Certificate Not Found ✗
```
Enter random certificate ID
  → No blockchain record found
  → Certificate not found
```

### Scenario 5: Revoked Certificate ✗
```
Super Admin revokes certificate (real transaction)
  → Verifier checks certificate
  → Status = Revoked
  → ✗ REVOKED
```

### Scenario 6: POL Transfer Demo ✗
```
Admin Portal → Blockchain → Send Test POL
  → Enter recipient + amount
  → MetaMask confirms
  → Real Polygon Amoy transaction
  → Transaction hash visible
  → Explorer link works
```

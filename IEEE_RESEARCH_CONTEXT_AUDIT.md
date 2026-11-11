# CertiProof — MASTER RESEARCH CONTEXT & IEEE EVIDENCE AUDIT

**Purpose:** Factual, forensic, 0→100% project context for writing an IEEE-quality research paper.
**Produced:** 2026-10-17 (read-only repository inspection; no code, config, database, blockchain, Supabase, IPFS, or deployment was modified).
**Sources:** complete repository tree, `contracts/`, `src/`, `scripts/`, `test/`, `benchmarks/`, `supabase/`, `context_md/` (21 files), root documentation (`README.md`, `PROJECT_SUMMARY.md`, `BUILD_PLAN.md`, `CertiProof_Master_Build.md`, `AGENTS.md`, `context_md/audit.md`), `CERTIPROOF_PROJECT_CONTEXT_REPORT.md` (structure), `package.json`, `deployment.json`, `hardhat.config.cjs`, `.env.example`, `.gitignore`, git status.

**Predecessor document:** `CERTIPROOF_PROJECT_CONTEXT_REPORT.md` (187,272 B, produced 2026-10-16, 35 sections + fact sheet). This audit independently re-verified its headline numbers directly against the raw `benchmarks/*.json` artifacts and the Solidity source. Where this audit and that report differ, both are reported.

---

## EVIDENCE STATUS TAXONOMY (used throughout)

| Tag | Meaning |
|---|---|
| **[1 IMPLEMENTED]** | Present and verified in source code in this repository. |
| **[2 LIVE VERIFIED]** | Exercised against live external systems (Polygon Amoy / Pinata / Supabase). Sub-label **(machine artifact)** = stored as JSON output; **(prose-recorded)** = recorded only as prose in `context_md/*.md`, raw output not persisted. |
| **[3 UNIT-TEST VERIFIED]** | Covered by an automated test in `test/`. Outcomes recorded as prose ("123 pass / 0 fail"); the suite was **not re-run during this audit**. |
| **[4 OBSERVED]** | Directly observed during this inspection (files, git state, counts). |
| **[5 DESIGN/INTENDED]** | Documented intent/design only; not proven by execution. |
| **[6 NOT IMPLEMENTED]** | Absent from the codebase. |
| **[7 NOT MEASURED]** | No measurement exists in the repository. |
| **[8 REQUIRES EXTERNAL CONFIGURATION** | Cannot be verified or enabled from this repository alone. |
| **[9 LIMITATION]** | Inherent constraint of the current design/implementation. |

**Hard rules honored:** no invented numbers; no conversion of observations into universal claims; no "accuracy" language (the project never measured classification accuracy); no "statistically significant" language (no statistical analysis exists); conflicts reported, not silently resolved; missing evidence written as "NOT AVAILABLE FROM CURRENT PROJECT EVIDENCE" / "REQUIRES NEW EXPERIMENT" / "NOT VERIFIED".

---

# PART 1 — PROJECT DISCOVERY

## 1.1 Repository map (excluding node_modules/artifacts/cache/build output)

| Area | Contents |
|---|---|
| Root docs | `README.md` (1.2 KB), `PROJECT_SUMMARY.md` (10.9 KB, STALE — see Conflict C-2), `BUILD_PLAN.md` (17.9 KB, planning-era, all phases marked PENDING), `CertiProof_Master_Build.md` (47.9 KB), `AGENTS.md` (session rules), `context_md/audit.md` (21.3 KB, severity baseline C-01…C-06, H-01…H-08, M-01…M-07, L-01…L-03), `CERTIPROOF_PROJECT_CONTEXT_REPORT.md` + `.pdf` (prior report). |
| Session history | `context_md/` — 20 dated session files (2026-08-31 → 2026-10-16) + `audit.md`. **Git-ignored.** |
| Smart contract | `contracts/CertChainRegistry.sol` (179 lines, no imports). |
| Deployment | `deployment.json` (git-ignored), `scripts/deploy.cjs`, `scripts/add-issuer.cjs`, `scripts/check-contract.cjs`, `hardhat.config.cjs`, `tsconfig.hardhat.json`. |
| Frontend | `src/` — TanStack Start/Router, React 19, 11 routes, `src/components/` (ui/, common/, verify/, certificate/, dashboard/, layout/, landing/), `src/lib/`, `src/routes/`. |
| Blockchain layer | `src/lib/blockchain/{contracts,metamask,verify,confirmation,types}.ts`, `src/lib/hooks/useWallet.tsx`, `src/lib/pending-transactions.ts`. |
| Core service | `src/lib/certificates.ts` (56.7 KB — issuance, verification, Supabase, revocation orchestration), `src/lib/certificate-fingerprint.ts`, `src/lib/crypto.ts`, `src/lib/issuance-timing.ts`, `src/lib/types.ts`. |
| IPFS/server | `src/lib/ipfs.ts` (client → server function), `src/lib/server/pinata.ts` (server-only). |
| PDF/QR | `src/lib/pdf/generate-certificate.ts`, `src/lib/pdf/extract-certificate-metadata.ts`, `src/components/common/QRCodeCard.tsx`, `src/components/certificate/CertificatePreview.tsx`, `src/lib/image-export.ts`. |
| Dead/prototype | `src/lib/certiproof.ts` (**entire module dead** — 0 import sites), `src/lib/demo-data.ts` (partially live), `src/lib/ipfs.ts` gateway URL write-only. |
| Tests | `test/` — **7 files, 123 `test()` blocks, 28 `describe()`, 0 `it()`, 0 skips** [4]. **Untracked in git.** |
| Benchmarks | `benchmarks/{issuance,ipfs,verification}-results.json` [2 machine artifacts]. **Untracked.** |
| Bench/live scripts | `scripts/bench-{issuance,ipfs,verification}.ts`, `scripts/eval-metrics.ts`, `scripts/live-{e2e,confirmation,method-c,revoke}-check.ts`, `scripts/wrong-network-check.ts`, `scripts/check-fingerprint-compat.ts`. **Untracked.** |
| Supabase | `supabase/rls-hardening.sql` (**explicitly a proposal, not applied** — lines 5–10). |
| Config | `package.json` (name `tanstack_start_ts` — mismatch with product name), `vite.config.ts` (port 8080, nitro cloudflare-module preset), `bunfig.toml`, `tsconfig.json`, `eslint.config.js`, `.env` (**present locally, git-ignored, contains live `PINATA_JWT` and `DEPLOYER_PRIVATE_KEY` — values NOT read/reported**), `.env.example`. |
| Build output | `.output/` (built server/client bundles), `wrangler` config — git-ignored. |

## 1.2 Git state [4]

- Branch `main`; last commits: `e04b0dd "Report3"`, `92f659c "POL"`, `879711b`, `a3522da`, `4c34727`.
- **Tasks 1–10 are UNCOMMITTED:** 13 modified tracked files + 20 untracked paths including all of `test/`, `benchmarks/`, `src/lib/certificate-fingerprint.ts`, `src/lib/blockchain/confirmation.ts`, `src/lib/server/`, `supabase/`, all `scripts/bench-*` and `scripts/live-*`.
- `.env`, `deployment.json`, `context_md/` are git-ignored (`.gitignore:20,30,36`).

## 1.3 CONFLICT REGISTER (both sides reported, none silently resolved)

| ID | Conflict | Side A | Side B | Resolution status |
|---|---|---|---|---|
| C-1 | Contract address | `PROJECT_SUMMARY.md:28` and `src/lib/demo-data.ts:7`: `0x9C41ba7fD3a1E0Cd4E2a17b6E30fD2c9A1b47E30` | `deployment.json`, all benchmarks, all scripts: `0x09921D25cB513793e17082Cce0fB4F520f0CDF50` | Side B authoritative for all measured work; Side A is stale/demo. **The demo address is never referenced by live code** [4]. |
| C-2 | Project state | `PROJECT_SUMMARY.md`: "No smart contract written", "0% testing", ~25–30% complete | Current tree: deployed contract, 123 tests, live benchmarks | `PROJECT_SUMMARY.md` is STALE and false against current tree [4]. |
| C-3 | Certificate count on chain | 9 records (2026-10-08 session); 11 (7 active/4 revoked) (audit.md manuscript) | 16 (2026-10-14), 28 (2026-10-15 bench population), 24 Supabase rows (2026-10-16) | Registry grew over time; **any count must be date-stamped and re-measured read-only before publication** (audit C-02). |
| C-4 | Test-count arithmetic | `context_md/2026-10-15_235500.md`: Method C file = "16 tests" (self-flagged inconsistency) | File on disk: 14 `test()` blocks; 95+14=109 | Disk is authoritative [4]: **14**. |
| C-5 | Tamper detection rate | `benchmarks/verification-results.json` (2026-10-15T17:36Z, machine artifact): **2/4 (50%)** | `context_md/2026-10-15_235500.md` (same day, later, prose): live **5/5**; `context_md/2026-10-14_171533.md` (eval-metrics, prose): **6/6** | Three different measurements with different harnesses/dates. **Only 2/4 is a machine artifact.** All three must be quoted with dates; a fresh persisted re-run is required before publishing any detection rate. |
| C-6 | Blockchain-record check | Stored verification JSON: pass **0/10** (getLogs over publicnode) | `context_md/2026-10-16_152855.md` (prose): fixed via `resolveRegistrationTx`, Method A now shows real BLOCK #50,315,729 | Fix exists in code [1] but the stored benchmark still shows 0/10 — **re-run required**. |
| C-7 | Issuance baseline | Task 3 N=10 prose means (total 48063.75 ms) produced by **pre-Task-4 code with false-success timeouts** | Current `issuance-results.json`: **n=1** (9328 ms) | Old raw data deleted; not comparable. **REQUIRES NEW EXPERIMENT (n≥10) before publishing issuance latency.** |
| C-8 | Manuscript numbers | audit C-01: manuscript claims issuance 15–30 s, verification 3–8 s, upload 5–10 s, cost 0.001–0.005 POL | Measured: issuance ~48 s (prose, pre-fix), verification ~6.0 s (artifact), IPFS upload mean 9.5 s (artifact), registration gas ≈0.007236 POL (prose) | Manuscript numbers are **unsupported**; must be replaced with measured values or removed. Deployment cost 0.043 POL corroborated by `context_md/2026-08-31_122000.md`. |
| C-9 | Dashboard "Verified" metric | UI label "Verified" | Code counts certificates having a `transactionHash` (`dashboard.index.tsx:55`) — not verification events | Mislabeling confirmed [1]; do not cite as verification count. |
| C-10 | Pinata JWT exposure | audit C-05: historical `VITE_PINATA_JWT` client exposure | Current tree: server-only `PINATA_JWT`; bundle scans clean (Task 2, Task 8 prose) | Fixed in code [1]; **rotation status NOT RECORDED anywhere** → NOT VERIFIED. |
| C-11 | RPC URLs | `scripts/deploy.cjs` (drpc), measured work (publicnode), `demo-data.ts` (polygon.technology, unused) | — | All three appear; measurements used `https://polygon-amoy-bor-rpc.publicnode.com`. |
| C-12 | Project title | `CertiProof_Master_Build.md:40`: "Blockchain-Based Secure Certificate Verification" | `audit.md:9`: "Blockchain-Based Secure Academic Certificate Issuance and Verification Platform" | Report both; AGENTS.md uses the issuance-and-verification framing. |
| C-13 | L20 getLogs fix | Built & validated 2026-10-11 (Tenderly), **rolled back** 2026-10-11 | Re-fixed differently 2026-10-16 (`resolveRegistrationTx`, receipt-verified) | Current code has the Task-10 fix [1]; stored JSON predates it. |
| C-14 | QR microbenchmark | Task 3 prose: 94.45 ms | Current issuance JSON: 136.43 ms (n=1) | Different runs; quote with source/date. |
| C-15 | context_md continuity | `2026-10-08_180953.md` / `2026-10-14_161651.md`: "no prior context_md existed" | 2026-08-31 and 2026-09-16 files exist | NOT VERIFIED; likely a gitignore/glob tooling artifact (later session says glob missed gitignored files). |

---

# PART 2 — PROJECT IDENTITY (0→100%)

1. **Project name:** CertiProof (npm package name is `tanstack_start_ts` — scaffold leftover [4]).
2. **Full title:** "CertiProof — Blockchain-Based Secure Academic Certificate Issuance and Verification Platform" (`context_md/audit.md:9`). Alternate title variant in `CertiProof_Master_Build.md:40` (Conflict C-12). Final-year project, HITS (`AGENTS.md`).
3. **Problem:** Academic certificates are centralized, easily forged, hard to verify across institutions; reported motivation statistics (≈2M counterfeit degrees, ≈$600B/yr fraud, ~10% fraudulent applications) come from a cited secondary source (Pondkule & Kothari 2025, as recorded in `context_md/2026-10-14_161651.md`) — **the statistics themselves were NOT independently verified in this audit** (external citation; verify before publication).
4. **Motivation:** Anchor certificate identity in an immutable, publicly verifiable ledger so any third party can verify authenticity without trusting the issuer's database or a wallet/gas.
5. **Research problem:** How to provide tamper-evident, publicly verifiable certificate issuance/revocation/verification with (a) an integrity key that survives database loss, (b) verification without wallets or gas, and (c) detectable metadata manipulation — under testnet-scale constraints.
6. **Proposed solution:** A three-layer platform: SHA-256 metadata fingerprint as registry key → `CertChainRegistry` contract on Polygon Amoy as authority → IPFS (Pinata) for the document → Supabase as *untrusted* display metadata → three verification methods (hash, QR URL, document extraction).
7. **Main objective:** Working issuance→anchoring→verification→revocation lifecycle with evidence-backed integrity guarantees.
8. **Specific objectives (evidence-backed):** canonical fingerprint protocol (Task 1); server-side IPFS credentials (Task 2); issuance instrumentation (Task 3); honest transaction confirmation (Task 4); IPFS reliability benchmark (Task 5); verification benchmark (Task 6); robust document extraction (Task 7); security audit + wrong-network guard (Task 8); Supabase↔chain reconciliation (Task 9); end-to-end live validation (Task 10).
9. **Target users:** institutions issuing certificates; employers/public verifying them; students receiving them.
10. **System boundaries:** one deployed contract on one testnet; issuer list controlled by a single super-admin; Pinata-mediated IPFS; hosted Supabase; browser-based app; **no** email delivery, **no** in-app camera QR scanner, **no** OCR, **no** identity/registration layer for institutions.
11. **What it does:** issues certificates (7-stage pipeline), fingerprints metadata, generates PDF + PNG + QR (preview), pins to IPFS, registers on-chain with real receipt confirmation, records metadata in Supabase, verifies by hash / QR URL / document upload, revokes on-chain (super-admin), reconciles Supabase against chain, guards against wrong-network signing, classifies pending transactions honestly.
12. **What it does NOT do:** send email (simulated toast); export batch PDFs (simulated); persist settings (toast only); scan QR in-app (mock panel); retrieve/serve IPFS content (write-only); prove academic truth of contents; provide production auth (no route guards); index chain events by default (getLogs capped — see §3C); compute or compare document byte hash against the registry; support scanned/image-only PDFs in Method C (no OCR).
13. **Novel/contributing aspects actually supported:** (a) fully specified, backward-compatible canonical metadata fingerprint protocol with domain separation from document byte hash; (b) chain-authoritative reconciliation layer treating the off-chain DB as explicitly untrusted; (c) three-state transaction confirmation semantics (confirmed/failed/pending) that ban synthetic receipts; (d) dual-fingerprint document verification (registry integrity + document identity). **These are engineering contributions with test evidence, not proven novelty over all prior art — related-work comparison has NOT been completed** [9].
14. **Main research contribution (defensible):** an evidence-audited, reproducible certificate anchoring/verification pipeline whose integrity claims each map to a test or measurement.
15. **Technical contribution:** canonical SHA-256 fingerprint protocol + reconciliation helpers + confirmation state machine (all in `src/lib/`).
16. **Security contribution:** wrong-network pre-signing guard, receipt-validity rules (blockNumber>0), server-only secrets, Supabase poisoning defenses, error-sanitized IPFS proxy — supported by offline tests + audit prose.
17. **Verification contribution:** Methods A/B/C with measured behavior on negatives (unknown/malformed/garbage/revoked/chain-only).
18. **Experimental contribution:** three benchmark suites (IPFS n=36 cycles live; verification n=10 per method live; issuance n=1 live) + live script checks. **No statistical analysis, no comparative baseline, no accuracy metric** [7].

---

# PART 3 — COMPLETE SYSTEM ARCHITECTURE (reconstructed from source)

## A. Frontend [1]
- **Framework:** TanStack Start 1.168.32 (SSR on Vite 8), TanStack Router 1.170.18, React 19, TypeScript 5.8, Tailwind CSS v4, Radix/shadcn components, `sonner` toasts, `motion`, `recharts`.
- **Routing (11 routes, `src/routeTree.gen.ts`):** `/` landing; `/login`; `/dashboard` layout → `/dashboard/` (metrics), `/dashboard/certificates` (table/search/revoke); `/issue` (3-step wizard); `/issue/bulk` (CSV); `/verify` (Methods A/B/C entry); `/verify/$hash` (Method A result); `/certificate/$id` (detail).
- **State management:** local `useState` + three module stores: in-memory certificate store (`certificates.ts:40`), in-memory pending-transaction `Map` (`pending-transactions.ts:46`), `WalletProvider` context. `QueryClientProvider` mounted but **no `useQuery` usage anywhere** [4].
- **Wallet:** MetaMask via EIP-1193 (`metamask.ts`): `eth_requestAccounts`, auto-reconnect `eth_accounts`, `chainChanged/accountsChanged` listeners, `switchToAmoy` (`wallet_switchEthereumChain` + `wallet_addEthereumChain` fallback), issuer check `isAuthorizedIssuer`.
- **Verification UI:** Method A form → `/verify/$hash` runs `verifyCertificate`; Method B panel is a **static mock** (no camera/scanner library in the bundle — grep for `jsQR|zxing|getUserMedia|BarcodeDetector` = 0 code hits [4]); Method C file upload → `analyzeDocument` → `ForensicComparison`.
- **Issuance UI:** 3 steps, live `CertificatePreview`, 7-stage `ProgressSteps`, typed `IssuanceError` panel, one-shot (non-polling) "Check confirmation status" button, PNG export, **simulated email toast**.
- **Revocation UI:** `RevokeDialog` on dashboard rows → `revokeCertificate(id)`; disabled when already revoked.
- **Bulk issuance:** client CSV parse (`name,email,course,date,type`), sequential `issueCertificate` with 120 ms spacing, **stops batch on first error** (incl. pending); sample CSV from demo-data; **simulated batch-PDF toast**.
- **Certificate detail:** `/certificate/$id` uses `fetchVerifiedCertificateFromSupabase` (row + chain record + fingerprint gate).
- **QR workflow:** `qrcode` lib `toDataURL` in `QRCodeCard`; payload hard-coded `https://certiproof.app/verify/<hash>` (`CertificatePreview.tsx:277`); QR appears in React preview/PNG export **only — not embedded in the generated PDF** (`issueCertificate` calls `generateCertificateBlob` without `qrCodeDataUrl`) [1].

## B. Backend/server functions [1]
- Exactly **one** server function in the entire app: `uploadCertificateFileFn` (`src/lib/ipfs.ts:11-16`), created with `createServerFn`, CSRF-filtered (`src/start.ts:23-25`), importing server-only `src/lib/server/pinata.ts`.
- Request flow: browser `FormData` → server fn → `validateUploadForm` (FormData, file non-null/non-string, size>0, ≤10 MB, MIME ∈ {pdf,png,jpeg}, extension must match MIME — `pinata.ts:27-64`) → Pinata `pinFileToIPFS` with `Authorization: Bearer <PINATA_JWT>` → returns `{ok, cid, url}` or sanitized `{ok:false, message}` (no response detail leakage).
- **Secrets:** `PINATA_JWT` read only from `process.env` server-side; `DEPLOYER_PRIVATE_KEY` used only by Hardhat/scripts. Both live in the local `.env` (git-ignored) [4]. **No `VITE_PINATA*` occurrences exist in `src/`** [4].
- **Client-exposed (by design):** `VITE_CONTRACT_ADDRESS`, `VITE_EXPLORER_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. (`VITE_CHAIN_ID/VITE_NETWORK_NAME/VITE_APP_URL` have **no read sites** — chain ID hard-coded 80002 at `contracts.ts:25`.)
- Everything else (blockchain, Supabase, verification, issuance orchestration) runs **in the browser**.
- Server entry `src/server.ts` normalizes swallowed 500s to a static error page; `error-capture.ts` keeps last error (5 s TTL).

## C. Blockchain [1]
- **Network:** Polygon Amoy **testnet**, chain ID **80002** (`0x13882`); RPC `https://polygon-amoy-bor-rpc.publicnode.com`; explorer `https://amoy.polygonscan.com`.
- **Contract:** `CertChainRegistry`, Solidity **`^0.8.24`** (hardhat compiles 0.8.24, optimizer runs 200), **address `0x09921D25cB513793e17082Cce0fB4F520f0CDF50`**, deployed **2026-08-31T06:04:59.550Z** by `0x3e72b748a543DEc762a297F7304A04F980d7bC01` (`deployment.json`).
- **Functions used by the app:** `getCertificate`, `certificateIds(uint)`, `getCertificateCount`, `isAuthorizedIssuer`, `registerCertificate`, `revokeCertificate`. **ABI members never used:** `superAdmin`, `authorizedIssuers`, `certificates(string)`, `addIssuer`, `removeIssuer`, `getCertificateStatus`, `getIssuerCount`, `certificateExists` (dead).
- **Authorization:** two-tier — `superAdmin` (constructor-set, manages issuers, sole revoker) and `authorizedIssuers` mapping (may register). Frontend `login` advisory check only — **no route guards exist** (`beforeLoad|redirect` grep = 0) [1].
- **Transaction lifecycle:** wrong-network guard (chainId==80002, before fingerprint/PDF/IPFS and before `getSigner()`) → EIP-1559 fixed fees `maxPriorityFeePerGas` 30 gwei / `maxFeePerGas` 50 gwei → `submitTransactionAndConfirm` → `waitForTransactionConfirmation` (60 s `CONFIRMATION_TIMEOUT_MS`, `Promise.race`, receipt must have `blockNumber>0`, `status===1` → confirmed; `status===0` → failed; timeout with no receipt → **pending** with final one-shot receipt lookup) → receipt read via read-only RPC first, wallet provider second.
- **Events:** app queries `CertificateRegistered` logs via `getLogs(fromBlock:0)` — public RPC 10,000-block cap documented in code (`certificates.ts:88-99`); fallback `resolveRegistrationTx` accepts a Supabase candidate tx **only after receipt verification** (status 1 + matching log topic0/topic1 from the registry) (`certificates.ts:135-158`). **`CertificateRevoked` / issuer events are never queried** → revocation tx hashes are not recovered [1]. No `contract.on(...)` subscriptions anywhere.

## D. IPFS / Pinata [1]
- Upload path: `uploadToIPFS(file)` → server fn → `https://api.pinata.cloud/pinning/pinFileToIPFS`; CID from `IpfsHash`; gateway URL `https://gateway.pinata.cloud/ipfs/<cid>` returned.
- Validation: server-side only (10 MB, MIME+extension). Failure → typed `ipfs_failed` **before any gas is spent**; sanitized messages; no retry/fallback gateway.
- CID stored **on-chain** (3rd arg of `registerCertificate`) and in Supabase `ipfs_cid`.
- **Retrieval: the gateway URL is never consumed by the application** (write-only) — the only retrieval code is inside `scripts/bench-ipfs.ts` [1]. Verification "IPFS Document" check is only `ipfsCID ? "STORED" : "MISSING"` — **no content integrity check at verification time** [1].
- **Deduplication:** none in app code (contract only blocks duplicate `certificateId`); content-addressed dedup observed empirically in the benchmark (same file → identical CID `QmYC4nHdd2P89ieZgcjaN3yVSHfZZNq4oGyZTcTdaFeFtD`) [2 machine artifact].
- Bench-only: unpin cleanup (`DELETE /pinning/unpin/{cid}`), 3-attempt retrieval retry.

## E. Supabase [1]
- Client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (public anon key).
- **Single table `certificates`**, columns (`supabase.ts:9-23`): `id, certificate_id, recipient_name, recipient_email, course, certificate_type, certificate_hash, transaction_hash, issuer_wallet, ipfs_cid, issue_date, status, created_at`.
- Operations (all in `certificates.ts`): `select` (list / by id / by hash), `insert` (only **after** a real receipt; non-blocking), `update status` (gated: `.eq("certificate_id",…).eq("certificate_hash", <on-chain hash>)`), **no DELETE**.
- **Role:** display/auxiliary metadata ONLY — "Supabase for metadata, Polygon for truth" (`context_md/2026-08-31_151500.md`); code comment: "blockchain is authoritative… Supabase rows are untrusted display metadata… RLS itself is NOT enforced here" (`certificates.ts:274-281`).
- **Reconciliation (Task 9):** `lookupOnChainCertificateRecord` (found/missing/error), `isSupabaseMetadataConsistentWithChain` (re-hash row → compare to chain hash), `reconcileSupabaseRowsWithChain` (drop if unanchored, drop if hash mismatch, **chain status overrides**, fail-open on RPC error), `fetchVerifiedCertificateFromSupabase` (row AND chain AND fingerprint gate).
- **RLS state: NOT ENFORCED per in-repo evidence; live state NOT VERIFIED** [8]. `supabase/rls-hardening.sql` self-declares "REVIEWABLE PROPOSAL, not an applied migration" (lines 5–10): public SELECT, constrained INSERT (regex on id/hash/tx/issuer, non-empty CID, status enum), status-only UPDATE, immutability trigger, `revoke delete`, preflight queries. Residual risks documented in the file itself (hostile format-valid INSERT; hostile status UPDATE; service-role edge function recommended).

## F. PDF [1]
- **Generator:** jsPDF ^4.2.1, A4 landscape, mm units. Renders: background + double navy border, organization, **fixed title "Certificate of Completion" (ignores `certificate type`)**, "This is to certify that", recipient, "has successfully completed", course, `Date:`, `Certificate No:`, `ID:`, footer. Optional QR `addImage` branch exists but is **never called** [1]. **No PDF Info/XMP metadata is written** (no `setProperties` call) — "metadata" = visible text only [1].
- **Extraction (Method C):** `extract-certificate-metadata.ts` — raw-byte regex over `TextDecoder("latin1")` PDF literal strings, PDF-escape unescaping, 300-char cap, label-anchored extraction: `ID:` → certificate ID (fallbacks: `Certificate No:`, first `CERT-YYYY-NNNNNN` token); line after "this is to certify that" → recipient; line after "has successfully completed" → course; value after `Date:` → issue date. `complete` only if all four present.
- **Limitations (documented in code, lines 32-35):** no OCR; scanned/image-only PDFs → all-null, `complete=false`; non-CertiProof layouts unsupported; image uploads accepted by the widget yield no certificate ID → `not_found`.

## G. QR [1]
- Generation: `QRCode.toDataURL` in `QRCodeCard.tsx` (render-time; `qrGenerationMs` is always `null` in issuance timing by design).
- Payload format: `https://certiproof.app/verify/<0x-hash>` (hard-coded domain, **not** `window.location.origin` — `L5` finding).
- Extraction: `extractHashFromQrPayload` mirrors the `/verify_/$hash` route; **implemented in `test/` and `scripts/` only** — the app itself routes scanned URLs into Method A; **no in-app scanner exists** [6] (verify panel is decorative). Round-trip equivalence asserted in `test/verification.test.ts` tests 5–7 [3].

## H. Cryptography / hashing [1]
- **SHA-256** via Web Crypto (`crypto.subtle.digest`) in `src/lib/crypto.ts`; strings encoded UTF-8; output lowercase hex, prefixed `0x` at the fingerprint layer.
- **metadataFingerprint** = SHA-256 over canonical string (see PART 7). Generated: at issuance (`certificates.ts`), in verification (Supabase row re-hash), Method C (twice), `check-fingerprint-compat.ts`. Stored: on-chain `certificateHash` (bytes32), Supabase `certificate_hash`, QR payload. Compared: against on-chain hash in Methods A (metadata check), C (both fingerprints), reconciliation, compat script.
- **documentByteHash** = SHA-256 of raw uploaded/generated file bytes — reported in Method C output, **explicitly never compared to the registry** (code comments `certificates.ts:1393-1399,1429`; test `verification.test.ts` #10 asserts domain separation).
- **transaction hash** = Ethereum tx hash (keccak-derived, from the node) — proof of anchoring, not content integrity.
- **IPFS CID** = multihash content address (not SHA-256-of-metadata; unrelated to the fingerprint).

---

# PART 4 — END-TO-END LIFECYCLE

| # | Step | Input | Processing | Output | Storage | Trust level | Failure mode | Live tested? |
|---|---|---|---|---|---|---|---|---|
| 1 | Data entry | form fields (name, email, course, type, date) | per-step validation (email regex, required) | form object | browser memory | local | validation error, no side effects | UI [1] |
| 2 | Fingerprint generation | `certificateId\|recipientName\|course\|issueDate` canonical | trim → normalize date → UTF-8 → SHA-256 | `0x…` 64-hex | on-chain + Supabase + QR | protocol key | n/a (pure) | Live at issuance [2]; unit [3] |
| 3 | PDF generation | metadata | jsPDF render | PDF blob (~4.8 KB observed) | memory → File | document | jsPDF error | Live (n=1 artifact) [2] |
| 4 | IPFS upload | File | server fn validation → Pinata pin | CID | Pinata + on-chain + Supabase | storage | `ipfs_failed` before gas spent | Live (39/39 artifact) [2] |
| 5 | Blockchain prep | hash, CID, id | wrong-network guard; gas params | unsigned tx params | memory | — | `wrong_network` (guard) | Shim-checked [2 prose] |
| 6 | Wallet/network validation | `eth_chainId` | ==80002? | ok / typed error | — | guard | `wrong_network` | Script PASS (prose) [2p] |
| 7 | Transaction submission | tx params | MetaMask `eth_sendTransaction` | tx hash | pending registry (memory) | — | `submission_error` | Live [2] |
| 8 | Confirmation | tx hash | 60 s race + final receipt lookup | confirmed/failed/pending | memory | receipt | pending ≠ success | Live pending→confirmed block 50247727 (prose) [2p] |
| 9 | Receipt validation | receipt | `blockNumber>0 && status===1` | accepted/rejected | — | receipt validity | synthetic block-0 rejected | Unit (29 tests) [3] |
| 10 | On-chain registration | id, hash, CID, number | `registerCertificate` (onlyAuthorizedIssuer) | event `CertificateRegistered` | **blockchain (authority)** | highest | revert: duplicate id / zero hash / unauthorized | Live (many txs recorded in benchmarks) [2] |
| 11 | Supabase persistence | metadata + tx hash | insert only after receipt (non-blocking) | row | Supabase | untrusted display | insert fail doesn't block success | Live (n=1 timing) [2] |
| 12 | QR generation | hash | `QRCode.toDataURL` | PNG data URL | React preview/PNG | convenience | n/a | Live at render [1]; microbench 136.43 ms n=1 [2] |
| 13 | Retrieval | certificate id / hash | Supabase + chain reads (reconciled) | certificate detail | — | — | `not_found` / RPC error | Live e2e (prose) [2p] |
| 14 | Verification | A: hash; B: QR URL; C: PDF | see PART 8 | outcome + checks | — | — | `invalid_hash`/`rpc_error`/`not_found` | Live bench n=10/method [2] |
| 15 | Revocation | certificate id | `revokeCertificate` (**onlySuperAdmin**) | status=1 + event | blockchain | — | revert: not found / already revoked / unauthorized | Live tx block #50321993 (prose) [2p] |
| 16 | Post-revocation verification | hash/id | status read | `revoked` (A/B), `match`+revoked (C) | — | — | — | Live (prose) [2p] + bench n=1 [2] |

**ASCII sequence diagram (issuance + Method A verification):**

```
 Issuer UI         certificates.ts      pinata(server)   MetaMask      CertChainRegistry   Supabase
    |                   |                    |              |                |                |
    |--issue(form)----->|                    |              |                |                |
    |                   |--chainId==80002?-->| (guard)      |                |                |
    |                   |--fingerprint (SHA-256 canonical)  |                |                |
    |                   |--generate PDF (jsPDF)             |                |                |
    |                   |--POST FormData------------------->|                |                |
    |                   |                    |--pinFileToIPFS (JWT server-side only)          |
    |                   |<-------------------|---{cid}------|                |                |
    |                   |--registerCertificate(id,hash,cid,num)             |                |
    |                   |                    |              |--sendTransaction (30/50 gwei)-->|
    |                   |                    |              |                |                |
    |                   |--waitForTransactionConfirmation (60s race; receipt blockNumber>0)   |
    |                   |                    |              |<---receipt-----|                |
    |                   |--(only if confirmed) insert---------------------------------------------------->
    |<--success + hash + QR + PNG                |              |                |                |

 Verifier      verifyCertificate (read-only provider, no wallet)
    |--hash-->|--isHashLike-->|--enumerate certificateIds(i)-->|compare on-chain hash
    |         |--fetch Supabase row (fingerprint-gated)-->|--isAuthorizedIssuer-->|--status--> outcome
```

---

# PART 5 — SMART CONTRACT FORENSIC ANALYSIS

**File:** `contracts/CertChainRegistry.sol` — contract `CertChainRegistry`, `pragma solidity ^0.8.24`, MIT, **179 lines, zero imports (no OpenZeppelin)** [1]. Deployed `0x09921D25cB513793e17082Cce0fB4F520f0CDF50` on Polygon Amoy (80002), 2026-08-31T06:04:59.550Z.

**State:** `address public superAdmin`; `mapping(string => Certificate) public certificates`; `mapping(address => bool) public authorizedIssuers`; `address[] public issuerList`; `string[] public certificateIds`.

**Struct `Certificate`:** `bytes32 certificateHash; address issuerAddress; string ipfsCID; string certificateNumber; uint256 issueTimestamp; uint256 status;` (0=Active, 1=Revoked).

**Events:** `IssuerAdded(address indexed,uint256)`, `IssuerRemoved(address indexed,uint256)`, `CertificateRegistered(string indexed certificateId, bytes32 indexed certificateHash, address indexed issuer, uint256 timestamp)`, `CertificateRevoked(string indexed certificateId, uint256 timestamp)`.

**Modifiers:** `onlySuperAdmin`, `onlyAuthorizedIssuer`.

| Function | Purpose | Inputs | Outputs | State change | Access | Event | Failure conditions |
|---|---|---|---|---|---|---|---|
| `constructor()` | set superAdmin = deployer; self-authorize | — | — | superAdmin, mapping, issuerList | deployer | — | — |
| `addIssuer(address)` | authorize issuer | wallet | — | mapping+, issuerList+ | onlySuperAdmin | IssuerAdded | zero address; already authorized; not admin |
| `removeIssuer(address)` | deauthorize | wallet | — | mapping=false (list entry kept) | onlySuperAdmin | IssuerRemoved | not authorized; not admin |
| `isAuthorizedIssuer(address)` | lookup | wallet | bool | none | public view | — | — |
| `getIssuerCount()` | count active issuers (O(n) loop over list incl. removed) | — | uint | none | public view | — | — |
| `registerCertificate(string,bytes32,string,string)` | anchor certificate | id, hash, CID, number | — | new Certificate(status 0), certificateIds+ | onlyAuthorizedIssuer | CertificateRegistered | duplicate id (ipfsCID non-empty); zero hash; not authorized |
| `getCertificate(string)` | full record | id | 6-tuple | none | public view | — | "Certificate not found" if ipfsCID empty |
| `certificateExists(string)` | existence | id | bool | none | public view | — | — |
| `revokeCertificate(string)` | revoke | id | — | status 0→1 | **onlySuperAdmin** | CertificateRevoked | not found; already revoked; not admin |
| `getCertificateStatus(string)` | status | id | uint | none | public view | — | not found |
| `getCertificateCount()` | registry size | — | uint | none | public view | — | — |

**Security-relevant observations [4]:**
- **No `transfer/withdraw/upgrade/selfdestruct` — the contract holds no funds and has no admin-key rotation.**
- Revocation is **irreversible in code** (no un-revoke); **issuers cannot revoke — only the super-admin** (asymmetric model).
- Existence is keyed on `ipfsCID` string length (non-empty = exists) — consistent but unconventional.
- `certificateIds` array grows forever; **no index by hash** → hash lookup must enumerate (O(n) client-side scan — the scalability limitation).
- `issuerList` is append-only (removed issuers remain in the array; `getIssuerCount` filters).
- `certificateNumber` parameter is supplied by the app as the certificate ID (app-side convention).
- **No automated contract tests exist** (H-01 in `audit.md` remains open): `test/` contains only frontend unit tests; no Hardhat test file for `CertChainRegistry` [6]. No Slither/formal audit recorded [7].

---

# PART 6 — DATA MODEL

| Field | Source | Processing | Storage | Authoritative source | Used in verification |
|---|---|---|---|---|---|
| certificate ID | generated at issuance (`CERT-YYYY-NNNNNN`) | embedded in canonical string; contract key | on-chain (mapping key + `certificateNumber`), Supabase `certificate_id`, PDF `ID:` | **Blockchain** (key) | Method C extraction key; A/B indirect |
| recipient name | form | trim; in fingerprint | Supabase `recipient_name`, PDF text | Supabase (display) — protected by fingerprint | Method C field compare; fingerprint #1 |
| recipient email | form | — | Supabase `recipient_email` only (**not** in fingerprint) | Supabase | **Not used** in any verification |
| course | form | trim; in fingerprint | Supabase `course`, PDF text | Supabase (display) — fingerprint-protected | Method C field compare; fingerprint #1 |
| certificate type | form | — | Supabase `certificate_type` (**not** in fingerprint; PDF ignores it — fixed title) | Supabase | Not used |
| certificate hash (=metadataFingerprint) | SHA-256(canonical metadata) | see PART 7 | **on-chain `certificateHash`**, Supabase `certificate_hash`, QR payload | **Blockchain** | The registry key for A/B/C |
| transaction hash | node on submit | — | Supabase `transaction_hash`; receipt lookups | Node/receipt | Blockchain Record check (via receipt/log verification) |
| issuer wallet | `msg.sender` | — | on-chain `issuerAddress`, Supabase `issuer_wallet` | **Blockchain** | Issuer Authorization check |
| IPFS CID | Pinata `IpfsHash` | — | on-chain `ipfsCID`, Supabase `ipfs_cid` | **Blockchain** | IPFS Document check ("STORED"/"MISSING" only) |
| issue date | form | normalized in fingerprint | Supabase `issue_date`, on-chain `issueTimestamp` (block time — **not** the same value), PDF `Date:` | Supabase display / chain timestamp | Method C field compare; fingerprint #1 |
| status | derived from chain | 0/1 | on-chain `status`; Supabase `status` (mirror, overridden) | **Blockchain** | Revocation Status check |
| block number | receipt | — | computed live (`currentBlock − blockNumber`); **not stored in Supabase** (rows carry `block:0` in mapping) | Receipt | Confirmations check |
| document byte hash | SHA-256(PDF bytes) | — | **computed at Method C runtime only; never stored** | none | Reported only — never compared |
| QR payload | `https://certiproof.app/verify/<fingerprint>` | — | QR image (preview/PNG) | n/a (transport) | Method B entry |

**BLOCKCHAIN AUTHORITATIVE:** certificateHash, issuerAddress, ipfsCID, certificateNumber/id, issueTimestamp, status, registration receipt/logs.
**SUPABASE DISPLAY/AUXILIARY (untrusted):** recipient_name, recipient_email, course, certificate_type, transaction_hash, issuer_wallet, ipfs_cid mirror, issue_date, status mirror. Protected by fingerprint reconciliation, **not** by verified RLS.
**LOCAL DOCUMENT-DERIVED:** PDF bytes, documentByteHash, extracted fields (Method C), rendered QR PNG.

---

# PART 7 — FINGERPRINT / HASH PROTOCOL (exact, from `src/lib/certificate-fingerprint.ts`)

**Canonical string** = `certificateId.trim() + "|" + recipientName.trim() + "|" + course.trim() + "|" + normalizeIssueDate(issueDate)`, encoded **UTF-8**, hashed with **SHA-256** (Web Crypto), output **`0x` + 64 lowercase hex**.

**Date normalization:** ISO datetime (`2026-05-18T00:00:00+00:00`, `Z`, space-separated, any offset) → date component; ISO-style date → zero-padded `YYYY-MM-DD`; anything else kept verbatim (trimmed). Internal whitespace is **significant**; only outer whitespace trimmed; object key order irrelevant (positional array).

**Generated:** issuance; Method C (twice — registry re-hash and document re-hash); Supabase reconciliation; `check-fingerprint-compat.ts`. **Stored:** on-chain `certificateHash` (bytes32), Supabase `certificate_hash`, QR payload. **Recomputed & compared:** Method A metadata check, Method C (both), reconciliation, compat script. **Mismatch behavior:** Method A outcome remains hash-based (fingerprint check reported as a failing check); Method C → `mismatch`; reconciliation → row dropped; compat script → exit 1.

**Backward compatibility:** byte-identical to the legacy issuance formula — proven 12/12 Supabase + 12/12 chain (2026-10-14) and 24/24 + 24/24 (2026-10-16), both prose-recorded [2p]; unit proof `certificate-fingerprint.test.ts` #11 [3].

| Integrity mechanism | Input | Algorithm | Stored where | Compared against | Purpose |
|---|---|---|---|---|---|
| **metadataFingerprint** | canonical 4-field metadata string | SHA-256 (WebCrypto, UTF-8) | on-chain bytes32, Supabase, QR | recomputed fingerprints (A/C), Supabase rows | registry key; metadata integrity |
| **documentByteHash** | raw PDF bytes | SHA-256 | nowhere (runtime only) | **nothing** (explicit domain separation) | file-identity reporting |
| **transaction hash** | tx RLP | keccak-256 (node) | Supabase tx_hash; explorer | receipt lookup | anchoring proof |
| **IPFS CID** | file bytes (multihash) | SHA-256 + multihash/base58 | on-chain, Supabase | (benchmark only) content-addressed storage pointer |
| **receipt/log verification** | tx receipt topics | node-provided | (derived) | `CertificateRegistered` topic0/topic1 | proves a candidate tx really registered the cert |

**Critical distinctions (paper must not conflate):**
- `metadataFingerprint` ≠ `documentByteHash` (different inputs; never compared — audit C-03 root cause; now domain-separated with tests).
- `metadataFingerprint` ≠ transaction hash (content identity vs tx identity).
- `metadataFingerprint` ≠ CID (canonical text vs file bytes).
- on-chain value is the *fingerprint*, so **database loss does not lose the integrity key**; but **the fingerprint is over 4 metadata fields only — email, type, and PDF layout are outside the integrity envelope** [9].

---

# PART 8 — VERIFICATION METHODS A / B / C

**METHOD A — `verifyCertificate(hash)`** (`certificates.ts:642-883`):
1. Format gate `isHashLike` (`0x`+64 hex) → else `invalid_hash` (no network).
2. Read-only `JsonRpcProvider` (no MetaMask, no gas).
3. Contract handle.
4. **Linear registry scan**: `getCertificateCount()` → `certificateIds(i)` → `getCertificate(id)` → compare stored hash (case-insensitive, incl. `hexToBytes32` padding form).
5. Reads: chain record (authority); Supabase by hash (display metadata, copied only if recomputed fingerprint matches chain); `resolveRegistrationTx` (event scan → receipt-verified fallback); `isAuthorizedIssuer(issuer)`; confirmations = currentBlock − block.
6. Output: `verified | revoked | not_found | error` + 7 checks: Hash Match, Metadata Fingerprint (if row), Issuer Authorization, Revocation Status, Blockchain Record, Confirmations, IPFS Document.
- **Outcome semantics limitation:** outcome is `revoked ? revoked : verified` whenever the hash is found — individual failing checks (e.g., unauthorized issuer, missing metadata) do **not** flip the outcome (documented finding L9); `computeStatus()` (which would emit INVALID/UNAUTHORIZED) is dead code.

**METHOD B — QR payload → hash → Method A:** QR encodes `https://certiproof.app/verify/<hash>`; scanning with a phone camera opens the `/verify/$hash` route which executes the identical Method A pipeline. Payload build/extract functions exist in `test/` and `scripts/` only; **in-app scanning is a decorative mock** [6].

**METHOD C — document → extraction → fingerprints → comparison** (`analyzeDocument`, `certificates.ts:1401-1599`):
1. `documentByteHash` (reported only).
2. Raw-byte extraction of 4 fields; no certificate ID → `not_found`.
3. Chain + Supabase lookup by ID.
4. **Fingerprint #1** = re-hash Supabase row metadata → must equal on-chain hash (registry integrity).
5. Field comparisons: recipient, course, date (normalized), certificate ID — doc vs registry.
6. **Fingerprint #2** = re-hash *extracted document fields* (only if all 4 extracted) → must equal on-chain hash (document identity).
7. `match` only if complete && all 4 fields match && both fingerprints equal the chain hash; else `mismatch` / `not_found`.

| Method | Input | Processing | Blockchain read | Supabase read | Fingerprint | Output |
|---|---|---|---|---|---|---|
| A | 0x-hash (typed/URL) | format gate → linear scan → checks | **yes (authority)** | by hash (display, fingerprint-gated) | re-hash row vs chain | verified / revoked / not_found / error + 7 checks |
| B | QR payload URL | extract hash → identical to A | yes | yes | as A | same as A (10/10 consistent with A) |
| C | PDF file | extract fields → 2 fingerprints → compare | yes (by certificate ID) | by ID (fingerprint #1 source) | both recomputed | match / mismatch / not_found |

**What each CAN detect / CANNOT detect:**

| | Can detect | Cannot detect |
|---|---|---|
| A | hash not in registry; revoked status; unauthorized issuer (as a reported check); missing CID; unknown/malformed hashes | manipulation of any metadata field **not hashed** (email, type); that the *document* matches (never sees the file); academic truth |
| B | identical to A (same pipeline) | anything extra; **in-app scanning itself is not implemented** |
| C | recipient/course/date/ID tampering in the document's text layer; registry metadata poisoning (fingerprint #1 fails); missing fields (incomplete ≠ pass) | byte-level PDF tampering outside extracted fields (byte hash not compared); scanned/image PDFs (no OCR); email/type changes; layout tampering |

**Negative-behavior evidence** (all from `benchmarks/verification-results.json`, live, 2026-10-15): unknown hash → `not_found` 5/5 (10015.06–10926.37 ms); malformed hash → `invalid_hash` 4/4 (0.01–0.23 ms); malformed QR → 4 cases (0–0.01 ms); garbage files → `not_found` 3/3 (0.08–0.56 ms); chain-only cert → A `verified` with metadata `absent`, C `not_found`; revoked cert → A/B `revoked`, C `match` + status revoked.

---

# PART 9 — COMPLETE TESTING INVENTORY

## 9.1 Suite totals [4]

- **123 `test()` blocks across 7 files, 28 `describe()` blocks, 0 `it()`, 0 `.skip/.todo/.only`, 0 env-gated skips** (independently recounted by grep during this audit).
- **All 123 tests are offline/hermetic** — `fetch` mocked, chain/Supabase injected as stubs, no RPC URL or contract address in any test file. Live behavior is covered separately by scripts.
- **Stored outcome:** "123 pass / 0 fail (×2 clean runs)" — prose only, in `context_md/2026-10-16_132041.md`, `2026-10-16_152855.md`, and `CERTIPROOF_PROJECT_CONTEXT_REPORT.md:1256-1267`. **No raw `bun test` output artifact exists in the repo; the suite was not re-run in this audit → outcomes = PROSE-RECORDED.** One earlier run exited 1 with 0 reported failures (attributed to an IPFS network flake inside `ipfs-upload`) — a known inconsistency.
- **No Hardhat/contract tests, no CI (`.github/` absent), no coverage, no security-test framework** [6].

## 9.2 Historical test-count progression (all prose sources)

`20 (Task 1, 10-14)` → `41 (Task 2)` → `54 (Task 3)` → `83 (Task 4)` → `85 (Task 5)` → `95 (Task 6)` → `109 (Task 7/8)` → `123 (Task 9/10, current)`. Before 2026-10-14: **`test/` was empty** (`2026-10-08_180953.md`, `2026-10-14_171533.md`).

## 9.3 Task progression (staged series 1–10)

| Task | Mandate | Completion evidence (prose-recorded gates) | Session file |
|---|---|---|---|
| 1 | Canonical fingerprint protocol + backward compat | 20 tests pass; tsc/build 0; compat 12/12+12/12 MATCH | `2026-10-14_204722.md` |
| 2 | Server-side Pinata credentials | 41 pass; bundle clean of `PINATA_JWT`; live CID | `2026-10-14_222146.md` |
| 3 | Issuance instrumentation + measurement | 54 pass; 10/10 live issuance runs (pre-fix code) | `2026-10-14_231247.md` |
| 4 | Real confirmation state machine | 83 pass (29 new); live pending→confirmed block 50247727 | `2026-10-15_184924.md` |
| 5 | IPFS reliability benchmark | 85 pass; 39/39 uploads, 36/36 retrieval+integrity | `2026-10-15_170000.md` |
| 6 | Verification benchmark | 95 pass; A/B/C 10/10 each; tamper 2/4; fingerprint 23/23 | `2026-10-15_230829.md` |
| 7 | Method C extractor rewrite | 109 pass (14 new); live Method C 5/5 | `2026-10-15_235500.md` |
| 8 | Security/production audit A–J + wrong-network guard | 109 pass; secret scans PASS | `2026-10-16_002500.md` |
| 9 | Supabase↔chain hardening + RLS proposal | 123 pass (14 new) | `2026-10-16_132041.md` |
| 10 | Final E2E | 123 pass ×2; 42/42 live checks; 24/24+24/24 compat; real revoke tx | `2026-10-16_152855.md` |

All task changes remain **uncommitted** [4].

## 9.4 Complete test inventory (every test, exact names)

### `test/certificate-fingerprint.test.ts` — 20 tests, 2 describes — base: `CERT-2026-100001 | Asha Kumar | B.Tech Computer Science and Engineering | 2026-05-18`

| # | Test name | Category | Expected |
|---|---|---|---|
| 1 | fixed field order and separator produce the defined canonical string | fingerprint/unit | canonical `CERT-2026-100001\|Asha Kumar\|B.Tech…\|2026-05-18` |
| 2 | object key insertion order does not affect the canonical string | robustness | same canonical |
| 3 | leading and trailing whitespace is trimmed deterministically | robustness | equals base |
| 4 | internal whitespace is significant | unit | differs |
| 5 | issueDate normalizes to zero-padded ISO | fingerprint | `2026-5-8`→`2026-05-08` |
| 6 | TIMESTAMPTZ values reduce to their date component | fingerprint | 4 forms → `2026-05-18` |
| 7 | TIMESTAMPTZ date round-trip produces the same fingerprint as the plain date | fingerprint | equal |
| 8 | non-ISO dates are kept verbatim (trimmed) | robustness | verbatim |
| 9 | deterministic: same metadata twice produces identical fingerprints | fingerprint | equal |
| 10 | protocol vector: 0x + SHA-256 (UTF-8) of the exact canonical string | security | equals independent WebCrypto oracle |
| 11 | legacy compatibility: equals the original id\|name\|course\|date scheme | compat | equal |
| 12 | returns 0x-prefixed 64-char lowercase hex | fingerprint | `/^0x[0-9a-f]{64}$/` |
| 13 | TEST: changed recipient name does not match | tamper | fingerprint differs |
| 14 | TEST: changed course does not match | tamper | differs |
| 15 | TEST: changed issue date does not match | tamper | differs |
| 16 | TEST: changed certificate ID does not match | tamper | differs |
| 17 | single-character changes alter the fingerprint | tamper | differs |
| 18 | unicode recipient names are hashed as UTF-8 | fingerprint | matches UTF-8 oracle |
| 19 | whitespace-equivalent metadata produces the same fingerprint | robustness | equal |
| 20 | date form 2026-5-18 and 2026-05-18 produce the same fingerprint | fingerprint | equal |

### `test/ipfs-upload.test.ts` — 23 tests, 4 describes (fetch mocked; env JWT saved/restored)

| # | Test name | Category | Expected |
|---|---|---|---|
| 1 | returns undefined when the variable is absent | unit | `undefined` |
| 2 | returns undefined when the value is empty or whitespace | unit | `undefined` |
| 3 | returns the trimmed value when set | unit | trimmed |
| 4 | rejects non-FormData input | negative | `UploadValidationError` |
| 5 | rejects a form without a file entry | negative | "No file was provided" |
| 6 | rejects a string file entry | negative | "Invalid file upload." |
| 7 | rejects an empty file | negative | "The uploaded file is empty." |
| 8 | rejects an oversized file | negative | 10 MB limit message |
| 9 | rejects a disallowed MIME type | negative | "Unsupported file type" |
| 10 | rejects a missing MIME type | negative | "Unsupported file type" |
| 11 | rejects an extension that contradicts the MIME type | negative | "File extension does not match" |
| 12 | accepts a valid PDF and returns the file | positive | File instance |
| 13 | accepts PNG and JPEG certificates | positive | accepted |
| 14 | accepts a valid PDF without a file extension (current behavior locked in) | characterization | accepted |
| 15 | uploads to Pinata with a Bearer header and returns the CID | integration (mocked) | cid + gateway url; Bearer seen |
| 16 | maps a Pinata HTTP failure to a safe message without response details | security | generic message |
| 17 | maps a non-JSON Pinata response to a safe message | robustness | `ok:false` |
| 18 | maps a missing IpfsHash field to a safe message | negative | `ok:false` |
| 19 | maps a network failure to a safe message | robustness | network message |
| 20 | rejects without a configured credential and leaks no secret | security | "not configured", no secret |
| 21 | rejects an invalid file before contacting Pinata | security | `fetchCalled === false` |
| 22 | uploads a valid certificate end-to-end with the server credential | integration (mocked) | cid |
| 23 | does not leak the configured credential when Pinata rejects the request | security | no JWT in output |

### `test/issuance-timing.test.ts` — 13 tests, 6 describes

| # | Test name | Category | Expected |
|---|---|---|---|
| 1 | completed stages produce non-negative finite durations | unit | ≥0, finite |
| 2 | total duration is >= the sum of sequential measured stages | unit | inequality |
| 3 | endStage without startStage throws; startStage twice throws | negative | throws |
| 4 | recordStageDuration rejects negative or non-finite values | negative | throws |
| 5 | success refuses to finalize while a stage is still open | negative | throws |
| 6 | returns the operation's exact result, unaltered | unit | identity |
| 7 | a throwing operation propagates and still closes the stage | robustness | rejects; stage closed |
| 8 | timer.fail captures stage, category and submission state | instrumentation | fields set |
| 9 | module failure state is recorded and does not create a success record | unit | failure only |
| 10 | recordIssuanceSuccess stores timings and clears prior failure | integration | timings stored |
| 11 | records duration when the promise settles and wait resolves | robustness | non-blocking stage recorded |
| 12 | swallows rejections like the original .catch(() => {}) behavior | robustness | resolves undefined |
| 13 | custom logger receives structured success events without PII | security/PII | JSON lacks recipientEmail/recipientName/PINATA/private |

### `test/method-c-extraction.test.ts` — 14 tests, 2 describes (PDFs generated by app's jsPDF; fully offline)

| # | Test name | Category | Expected |
|---|---|---|---|
| 1 | 1+2+3+4. extracts certificate ID, recipient name, course and issue date | extraction | all 4 equal inputs |
| 2 | 5. all four fields extracted from one PDF (complete=true), including with an embedded image | robustness | complete |
| 3 | 6. recomputed fingerprint from extracted metadata equals the canonical fingerprint of the input metadata | round-trip | equal |
| 4 | 7. recipient-name modification changes extraction and alters the recomputed fingerprint | tamper | differs |
| 5 | 8. course modification changes extraction and alters the recomputed fingerprint | tamper | differs |
| 6 | 9. issue-date modification changes extraction and alters the recomputed fingerprint | tamper | differs |
| 7 | 10. certificate-ID modification changes extraction and alters the recomputed fingerprint | tamper | differs |
| 8 | 11. missing recipient name → extraction incomplete (explicit, not a placeholder) | negative | null + complete=false |
| 9 | 12. missing course → extraction incomplete | negative | null + complete=false |
| 10 | 13. malformed PDF bytes do not crash the extractor and report incomplete extraction | robustness | all null |
| 11 | 14. empty file does not crash the extractor or the verifier | robustness | not_found |
| 12 | 15. partial extraction: an ID-like line without anchors yields incomplete metadata | negative | complete=false |
| 13 | names with parentheses and escapes survive extraction (PDF string escaping) | robustness | exact match |
| 14 | ISO datetime issue dates printed by issuance normalize consistently | fingerprint | fp equal to plain date |

### `test/supabase-integrity.test.ts` — 14 tests, 2 describes (chain = injected stubs)

| # | Test name | Category | Expected |
|---|---|---|---|
| 1 | untampered metadata matches its own on-chain fingerprint | integrity | true |
| 2 | fingerprint comparison is case-insensitive | robustness | true |
| 3 | tampered recipient name no longer matches the on-chain anchor | tamper/security | false |
| 4 | tampered course no longer matches the on-chain anchor | tamper/security | false |
| 5 | tampered issue date no longer matches the on-chain anchor | tamper/security | false |
| 6 | row re-keyed to a different certificate id no longer matches the on-chain anchor | tamper (re-keying) | false |
| 7 | a fingerprint belonging to a different certificate does not match | tamper | false |
| 8 | matching row is kept and the on-chain status overrides the client-supplied one | integrity (status poisoning defense) | kept, status=revoked |
| 9 | row whose certificate_hash does not match the on-chain record is dropped | poisoning | dropped |
| 10 | hash comparison is case-insensitive (stored lowercase, chain checksummed) | robustness | kept |
| 11 | metadata-only row without an on-chain record is dropped | poisoning | dropped |
| 12 | inconclusive lookup (RPC error) keeps the row unchanged — availability over strictness | fail-open documented | kept unchanged |
| 13 | mixed batch: only chain-anchored rows survive, each with chain status | integration | 1 survivor, status revoked |
| 14 | empty input produces empty output | unit | [] |

### `test/transaction-confirmation.test.ts` — 29 tests, 9 describes (fabricated receipts; no chain)

| # | Test name | Category | Expected |
|---|---|---|---|
| 1 | the measured 60s confirmation timeout baseline is unchanged | unit | 60_000 |
| 2 | a blockNumber: 0 receipt is never valid evidence of mining | security | false for 0/−1/missing/null; true for 42 |
| 3 | TEST 1: submitted + real successful receipt → confirmed | functional | confirmed/mined_success |
| 4 | TEST 2: submitted + receipt with status 0 → failed | negative | failed/mined_reverted |
| 5 | wait() rejecting with a CALL_EXCEPTION receipt (revert) → failed | negative | failed |
| 6 | a mined receipt without a success status is never confirmed | security | receipt_status_unknown |
| 7 | TEST 3: submitted + timeout + no receipt → pending, MUST NOT be success | security (core) | pending/timeout_no_receipt |
| 8 | TEST 9: a synthetic blockNumber: 0 receipt is not treated as confirmed | security | pending/receipt_not_mined |
| 9 | TEST 9b: a synthetic blockNumber: 0 receipt from the final check stays pending | security | pending |
| 10 | TEST 8: tx hash is preserved when confirmation stays pending | robustness | pending + hash kept |
| 11 | TEST 5: timeout, but a receipt appears during the final check → confirmed | robustness | confirmed |
| 12 | a receipt found after a wait error is classified from the real receipt | robustness | failed (status 0) |
| 13 | a definitively cancelled replacement → failed (never confirmed) | negative | replacement_cancelled |
| 14 | a repriced replacement that mined successfully confirms under the mined hash | blockchain | confirmed under replacement hash |
| 15 | TEST 6: the confirmation timer is cleared after success | robustness | timer cleared |
| 16 | TEST 7: the confirmation timer is cleared after failure | robustness | cleared |
| 17 | the confirmation timer is cleared after a timeout as well | robustness | fired+cleared |
| 18 | TEST 4: submission throws → failed / submission_error (no tx hash) | negative | submission_error |
| 19 | a submission that yields no transaction hash → failed / submission_error | negative | submission_error |
| 20 | submitted + confirmed: onSubmitted fires before the wait and the result confirms | functional | order verified |
| 21 | submitted + pending: onSubmitted fires and the hash survives the timeout | robustness | hash survives |
| 22 | a real mined receipt with status 1 → confirmed | functional | confirmed |
| 23 | a real mined receipt with status 0 → failed | negative | failed |
| 24 | no receipt yet → pending (never success) | negative | pending |
| 25 | an RPC error during the re-check → pending/unknown (never success) | robustness | pending |
| 26 | a synthetic blockNumber: 0 receipt from the RPC path → pending | security | pending |
| 27 | records an issuance and preserves its tx hash and payload | pending registry | recorded |
| 28 | records a revocation and removes it after a definitive re-check | pending registry | removed |
| 29 | reset clears all pending records | unit | empty |

### `test/verification.test.ts` — 10 tests, 3 describes (offline; resolve before network)

| # | Test name | Category | Expected |
|---|---|---|---|
| 1 | empty hash is rejected as invalid_hash without any network access | negative | invalid_hash |
| 2 | short 0x hash is rejected as invalid_hash | negative | invalid_hash |
| 3 | non-hex 64-char payload is rejected as invalid_hash | negative | invalid_hash |
| 4 | isHashLike matches exactly 0x + 64 hex characters | unit | true/false vector |
| 5 | buildQrPayload produces the application's exact QR URL format | Method B | `https://certiproof.app/verify/<hash>` |
| 6 | extractHashFromQrPayload mirrors the /verify_/$hash route param | Method B | round-trip; nulls for bad inputs |
| 7 | a malformed hash extracted from a QR payload flows through the same validation as Method A | Method B/negative | same outcome as A |
| 8 | a text file renamed to .pdf yields not_found (no certificate ID extracted, no network) | PDF negative | not_found |
| 9 | an empty file yields not_found | robustness | not_found |
| 10 | documentByteHash is the SHA-256 of the uploaded bytes (separate domain from metadataFingerprint) | fingerprint domain separation | equals WebCrypto SHA-256 |

## 9.5 Live-check scripts (not tests; state-changing ones marked)

| Script | Network | State-changing | Scenarios | Output persisted? |
|---|---|---|---|---|
| `live-e2e-check.ts` | LIVE (hardcoded publicnode + contract) | read-only | preflight chainId; chain record; fingerprint format; CID; optional `--tx` receipt+log; issuer auth; Method A all checks + real block; Method B consistency; Supabase row; Method C match; tamper copies (recipient/course/date → mismatch; unknown ID/malformed/empty PDF → not_found); detail fetch; reconciliation + fail-open demo; exit 1 on any failure | **No** (console). Run result "42/42 PASS" prose-only |
| `live-confirmation-check.ts` | LIVE | **YES — one 0-value self-transfer** | pending ≠ success with 1 ms timeout; one-shot poll ≤180 s; final receipt must be block>0,status 1 | **No**. "confirmed block 50247727 @t+5.4 s" prose |
| `live-method-c-check.ts` | LIVE (chain+Supabase) | read-only | 5 scenarios: original match; recipient/course/date tamper → mismatch; unknown ID → not_found | **No**. "5/5 PASS, 741 ms" prose |
| `live-revoke-check.ts` | LIVE | **YES — one real revokeCertificate tx** | pre-state active + A verified + Supabase row; revoke; post: chain revoked, A/B revoked, C match+revoked, Supabase flipped | **No**. tx `0xfd8fa7f8…` block #50321993 prose |
| `wrong-network-check.ts` | shim (`eth_chainId 0x1`) | no | issue+revoke must throw `wrong_network`; `transactionSubmitted===false`; no `eth_sendTransaction` in log | **No**. "ALL PASS, zero funds" prose |
| `check-fingerprint-compat.ts` | LIVE (Supabase+chain) | read-only | per row: recompute fingerprint vs stored hash vs on-chain hash; exit 1 on mismatch | **No**. "24/24 + 24/24" prose |

---

# PART 10 — COMPLETE EVALUATION DATA (exact values, machine artifacts unless noted)

## 10.1 `benchmarks/verification-results.json` — generated **2026-10-15T17:36:44.832Z**, live read-only Polygon Amoy, RPC publicnode, contract `0x0992…DF50`, target/executed 10 per method [2 machine artifact]

| Metric | Value (ms unless noted) | n | Source key |
|---|---|---|---|
| Method A total | min 2707.02 / median 6097 / mean **6022.47** / max 8006.71 / stdDev 1678.63 | 10 | `methodA.stats` |
| Method A stage validate | 0.05/0.17/0.39/2.24/0.66 | 10 | `methodA.stageStats.validate` |
| Method A stage provider | 0.05/0.11/0.2/0.94/0.26 | 10 | `methodA.stageStats.provider` |
| Method A stage contract | 1.21/2.35/2.24/3.45/0.68 | 10 | `methodA.stageStats.contract` |
| Method A stage searchAndDecision | 2702.03/6092.99/**6019.64**/8005.06/1679.5 | 10 | `methodA.stageStats.searchAndDecision` |
| Method B total | min 2723.02 / median 6062.79 / mean **6038.49** / max 7977.36 / stdDev 1713.07 | 10 | `methodB.stats` |
| Method B vs A consistency | **10/10 (100%)** | 10 | `methodB.consistencyVsMethodA` |
| Method C total | min 515.15 / median 544.2 / mean **551.11** / max 624.44 / stdDev 32.66 | 10 | `methodC.stats` |
| Method C stage registrySearch | 514.46/541.23/**549.39**/623.68/33.3 | 10 | `methodC.stageStats.registrySearch` |
| Unknown hash → not_found | 10015.06, 10926.37, 10308, 10259.37, 10297.76 (mean ≈10361.31 [DERIVED]) | 5 | `negatives.unknownHash` |
| Malformed hash → invalid_hash | 0.23, 0.03, 0.01, 0.01 | 4 | `negatives.malformedHash` |
| Malformed QR | 0.01, 0, 0, 0.01 (3 malformed_payload + 1 invalid_hash) | 4 | `negatives.malformedQr` |
| Unknown QR hash → not_found | 10231.06, 10593.01 | 2 | `negatives.unknownQr` |
| Tamper issue-date | 516.45 → `mismatch` (**detected**) | 1 | `negatives.tamper[0]` |
| Tamper recipient | 536.68 → `match` (**NOT detected**) | 1 | `negatives.tamper[1]` |
| Tamper course | 531.51 → `match` (**NOT detected**) | 1 | `negatives.tamper[2]` |
| Tamper certificate-ID | 402.05 → `not_found` (**detected**) | 1 | `negatives.tamper[3]` |
| Garbage inputs → not_found | 0.56 (text renamed .pdf), 0.2 (png), 0.08 (empty) | 3 | `negatives.garbageInputs` |
| Chain-only cert | A 1617.05 `verified` (metadata absent); C 532.64 `not_found` | 1 each | `chainOnly` |
| Revoked cert | A 3364.66 `revoked`; B 3260.29 `revoked`; C 594.85 `match`+revoked | 1 each | `revoked` |
| Population | onChain 28, Supabase rows 23, Supabase-backed 23, chain-only 5, revoked 5 | — | `population` |
| Fingerprint consistency (recomputed = chain = Supabase) | **23/23 (100%)** | 23 | `fingerprintConsistency` |
| Static secret scan | 5 patterns (`PINATA_JWT`,`DEPLOYER_PRIVATE_KEY`,`service_role`,`pinata.cloud`,`PRIVATE_KEY`) over 6 files, **findings: []** | — | `security` |
| Reliability block | A 10/10; B 10/10; C 10/10; unknown 5/5; malformed 4/4; **tamper 2/4 (50%)**; fingerprint 23/23 | — | `reliability` |
| Blockchain Record check | **pass 0/10** (pre-fix getLogs defect) | 10 | `methodA.runs[*].blockchainRecordPass` |

## 10.2 `benchmarks/ipfs-results.json` — generated **2026-10-15T16:18:02.772Z**, Pinata API + `gateway.pinata.cloud` [2 machine artifact]

| Metric | min | median | mean | max | stdDev | n |
|---|---:|---:|---:|---:|---:|---:|
| **Upload (ms)** | 1070.15 | 3881.22 | **9508.25** | 54534.18 | 12037.31 | 36 |
| **Retrieval (ms)** | 4593.96 | 7045.28 | **7181.63** | 11009.05 | 1687.95 | 36 |

Per-size upload mean (n=5 each): 10KB 1154.14; 100KB 1400.51; 500KB 2540.10; 1MB 4106.02; 2MB 7517.13; 5MB 20527.66; 10MB 30805.56. Per-size retrieval mean: 10KB 6598.31; 100KB 5445.85; 500KB 6211.91; 1MB 7106.93; 2MB 8354.96; 5MB 8067.88; 10MB 8703.52. (Full min/median/max/stdDev per size stored in `stats.bySize`.)

Reliability: **upload 39/39 (100%)**; **retrieval first-attempt 36/36**; with-retries 36/36; **byte-identical integrity 36/36 (SHA-256 original == retrieved)**; delayed certificate recheck at +652,739.15 ms → retrieval 6535.42 ms, integrity true; dedup same-file CID equal `true` (uploads 1493.22 ms / 838.77 ms, same `QmYC4nH…`), different-file CID equal `false`; error probes 4/4 as expected, `secretLeaked:false` ×4; unpin cleanup 37/39. Certificate PDF (4795 B): upload 2041.45 ms, retrieval 6091.88 ms.

## 10.3 `benchmarks/issuance-results.json` — generated **2026-10-16T08:11:24.156Z**, live Amoy, **n = 1** [2 machine artifact — SINGLE RUN]

| Stage | Value (ms) |
|---|---:|
| fingerprintGeneration | 1.74 |
| pdfGeneration | 33.55 |
| ipfsUpload | 2117.72 |
| blockchainPreparation | 38.5 |
| blockchainSubmission | 1897.7 |
| blockchainConfirmation | 5232.65 |
| supabasePersistence | 1468.89 |
| **totalIssuance** | **9328** |
| QR microbenchmark (separate) | 136.43 |

`stdDev: 0` at n=1 is a coding convention, **not measured zero variance**. Run: `CERT-2026-273168`, tx `0x823d7bc4…8a703`, CID `QmVgzPmUdtTue47jgzwR1G3WogXuH9fgguoEgzRthmqoSu`, receipt block #50315729 (prose).

## 10.4 Prose-only measurements (NO raw artifact — cite with date + source, mark as recorded observation)

| Measurement | Value | n | Source | Caveat |
|---|---|---|---|---|
| Issuance stage means (Task 3) | fingerprint 4.67; pdf 14.67; ipfs 1524.84; prep 34.36; submit 1511.28; confirm **44972.59**; supabase 456.29; **total 48063.75**; QR 94.45 | 10 | `2026-10-14_231247.md` | Pre-Task-4 code; **5/10 runs falsely timed out** (mined 37–166 s later); raw data deleted → not comparable to current code |
| Gas registration | mean **241,189** (range 240,060–257,964) ≈0.007236 POL @30 gwei; revocation 60,932 each | 16 / 4 | `2026-10-14_171533.md` (eval-metrics) | Unpersisted; earlier runs: 241,860 (n=13, 10-08), 241,696 (n=11, 10-11) |
| Verification latency (chain-only, eval-metrics) | registered mean 3,177.4 ms; missing mean 7,399.6 ms; 2 warm-ups | 10+10 | `2026-10-14_171533.md` | Unpersisted; earlier: 2943/3973 (10-08), 2803/4264 (10-11) |
| Scalability fit (O(n) scan) | 411.6 ms×n + 389.4 (k=1..16); earlier 352.2×n+346.7; 368.8×n+171.5 | k∈{1..16}×3 | `2026-10-14_171533.md` | Unpersisted; **small k, testnet RPC** |
| Throughput | 0.31 reg/s; 0.19 mixed/s (earlier 0.34/0.36) | — | same | Unpersisted |
| Tamper detection (eval-metrics, local mutations) | **6/6 = 100%** | 6 | 10-08/10-11/10-14 notes | Different harness (metadata mutation vs PDF byte mutation) than bench 2/4 |
| SHA-256 micro | 0.070 / 0.071 / **0.264** ms | N=1000 | eval-metrics runs | Unpersisted, varies by run |
| jsPDF micro | 3.7 / 5.0 / **11.0** ms | N=5 | eval-metrics runs | Unpersisted |
| getLogs failure | publicnode `fromBlock:0` **0/11** success (`-32701 exceed maximum block range: 10000`) | 11 | 10-08/10-14 notes; code comment | Fixed by Task-10 `resolveRegistrationTx` (prose 10-16) |
| Task 10 live E2E | **42/42 checks PASS**; reconciliation **24/24 anchored**; fingerprint compat **24/24 stored + 24/24 chain** | — | `2026-10-16_152855.md` | Prose only |
| Task 10 revoke | tx `0xfd8fa7f8…` block #50321993 status 1; A/B revoked; C match+revoked | 1 | same | Prose only |
| Task 4 live confirmation | pending → confirmed block **50247727** @ t+5.4 s; separate issuance total 8854.83 ms / confirm 4945.5 ms | 1+1 | `2026-10-15_184924.md` | Prose only |
| Task 7 live Method C | 5/5 PASS (original 741 ms; recipient/course/date → mismatch; unknown → not_found) | 5 | `2026-10-15_235500.md` | Prose only |
| Contract deployment cost | ~0.043 POL; balance ~0.055 POL after deploy | 1 | `2026-08-31_122000.md` | Prose only |
| IPFS live probe failure (eval-metrics) | 0/3 gateway GETs (HTTP 400/429) | 3 | `2026-10-14_171533.md` | Conflicts with bench 36/36 — different days/endpoints; report both |

**NOT AVAILABLE FROM CURRENT PROJECT EVIDENCE:** p50/p95/p99 beyond stored medians; standard-deviation for prose-only series (except Task-3 confirm ≈19.9 s prose); browser/OS/CPU/RAM/Bun-version of the benchmark host; warm-up effects (no warm-ups in the three persisted benchmarks); statistical significance tests of any kind; accuracy metrics (never measured); Supabase operation latency beyond the single n=1 insert; wrong-network timing; PDF generation latency beyond n=1 + prose micro-runs.

---

# PART 11 — IEEE PAPER TABLES THAT CAN BE SUPPORTED BY THE CURRENT PROJECT

Legend: **READY** = evidence exists now; **PARTIAL** = some rows evidence-backed, gaps noted; **NOT SUPPORTED** = REQUIRES NEW EXPERIMENT.

| # | Proposed table | Purpose | Columns available | Data available | Source | Status | Missing |
|---|---|---|---|---|---|---|---|
| T1 | System Technology Stack | reproducibility | Component, Technology, Version/Notes | full | `package.json`, configs | **READY** | none |
| T2 | Smart Contract Functionality | contract spec | Function, Access, State change, Event, Revert conditions | full (11 fns) | `CertChainRegistry.sol` | **READY** | none |
| T3 | System Components and Responsibilities | architecture | Component, Responsibility, Location | full | `src/**` | **READY** | none |
| T4 | Blockchain vs Off-Chain Data Trust Model | trust boundaries | Data item, Location, Authority, Protection | full | code + recon | **READY** | none |
| T5 | Certificate Data Model | schema | Field, Type, Source, Storage, Authority | full | `supabase.ts`, contract | **READY** | none |
| T6 | Fingerprint / Integrity Mechanisms | hash domain separation | Mechanism, Input, Algorithm, Stored, Compared, Purpose | full | `certificate-fingerprint.ts` | **READY** | none |
| T7 | Verification Methods Comparison | methods A/B/C | Method, Input, Reads, Fingerprint, Output, Latency (n/min/median/mean/max/std) | full + timings | verification JSON | **READY** | none |
| T8 | Functional Test Cases | correctness | ID, Case, Input, Expected, Actual, Result | 123 tests + bench positives | `test/**`, bench JSON | **READY** (mark tests offline; outcomes prose-recorded) | raw `bun test` log |
| T9 | Security Test Cases | defenses | Case, Threat, Expected defense, Result, Evidence | ~25 security-tagged tests + audit A–J + static scan | tests, `2026-10-16_002500.md`, bench `security` | **PARTIAL** | contract-level authz tests (none) |
| T10 | Negative Test Cases | rejection behavior | Case, Input, Expected, Result, Latency | full | bench `negatives` + negative tests | **READY** | none |
| T11 | Tampering Detection Evaluation | tamper results | Case, Method, Expected, Actual, Detected? | **conflicting**: stored 2/4 vs prose 5/5 vs prose 6/6 | 3 sources | **PARTIAL — REQUIRES NEW PERSISTED RE-RUN** for a single publishable rate | post-Task-7 persisted re-run |
| T12 | Verification Performance | latency A/B/C | Method, n, min, median, mean, max, stdDev, correctness rate | full | verification JSON | **READY** | percentiles (optional) |
| T13 | Certificate Issuance Performance | stage latency | Stage, n, min, median, mean, max, stdDev | **n=1 only** (old N=10 prose, pre-fix) | issuance JSON | **NOT SUPPORTED — REQUIRES NEW EXPERIMENT (n≥10 re-run)** | sample size |
| T14 | IPFS Performance Evaluation | upload/retrieval by size | Size, n, min, median, mean, max, stdDev (upload + retrieval) | full (7 sizes ×5 + overall) | ipfs JSON | **READY** | none |
| T15 | Reliability Results | success rates | Metric, Successes/Attempts, Rate | full (IPFS 39/39, 36/36; verif 10/10 etc.) | bench JSONs | **READY** (date-stamp; testnet-only) | none |
| T16 | Revocation Evaluation | revoke lifecycle | Stage, Evidence, Result | prose (1 live revoke: pre/post checks) | `live-revoke-check` run | **PARTIAL — prose only** | persisted artifact / repeat runs |
| T17 | Wrong-Network Protection Evaluation | guard behavior | Scenario, Expected, Observed, Funds spent | prose (ALL PASS, 0 spend) + code guard | `wrong-network-check.ts` | **PARTIAL — prose only** | persisted output |
| T18 | Supabase Integrity / Reconciliation | poisoning defenses | Case, Expected, Result | 14 offline tests + recon prose 24/24 | tests + notes | **READY** (offline unit evidence) | live hostile-INSERT test (REQUIRES EXTERNAL CONFIG) |
| T19 | Fingerprint Consistency Evaluation | 3-way equality | Rows checked, Matches | 20 tests + 23/23 artifact + 24/24 prose | mixed | **READY** (quote 23/23 as artifact; 24/24 as prose) | none |
| T20 | End-to-End Lifecycle Evaluation | full pipeline | Step, Evidence, Result | prose 42/42 + issuance artifact | Task 10 note | **PARTIAL — prose only** | persisted e2e output |
| T21 | Benchmark Configuration / Experimental Setup | reproducibility | Parameter, Value | full | JSON `meta`, scripts, config | **READY** | host machine specs |
| T22 | Threats and Mitigations | security analysis | Threat, Surface, Defense, Status, Evidence | full (see PART 14) | code+tests+audit | **READY** | none |
| T23 | Security Audit Findings | audit record | Finding, Severity, Status | Task 8 A–J + audit.md C/H/M/L | notes + audit.md | **READY** (internal audit; **no external audit**) | external audit/dependency advisory scan |
| T24 | Existing System vs Proposed System | positioning | Feature, Conventional, CertiProof | qualitative only | design | **PARTIAL** | any measured baseline → **NO VALID COMPARATIVE EXPERIMENT AVAILABLE** |
| T25 | Limitations and Future Work | honesty section | Limitation, Cause, Impact, Evidence, Future work | full (see PART 20) | code+notes | **READY** | none |

Additional supportable: **gas-cost table** (prose only → REQUIRES PERSISTED RE-RUN), **scalability/O(n) table** (prose only → REQUIRES NEW EXPERIMENT), **throughput table** (prose only → REQUIRES NEW EXPERIMENT).

---

# PART 12 — IEEE FIGURE INVENTORY (documentation only; no diagrams created)

| Figure | Proposed title | What it shows | Evidence available | Recommended |
|---|---|---|---|---|
| F1 | CertiProof overall system architecture | UI → lib → (chain/IPFS/Supabase/server fn) | full source map | **Yes — primary** |
| F2 | Certificate issuance sequence | 7 stages incl. guard, pin, submit, confirm, persist | `certificates.ts` + timing stages | **Yes — primary** |
| F3 | Transaction confirmation state machine | submitted→confirmed/failed/pending; receipt rules | `confirmation.ts` + 29 tests | **Yes — primary** |
| F4 | Fingerprint generation flow | fields → canonical → SHA-256 → 0x hex → 3 stores | `certificate-fingerprint.ts` | **Yes — primary** |
| F5 | Verification Method A flow | hash → gate → scan → checks → outcome | `verifyCertificate` | **Yes** |
| F6 | Verification Method C flow | PDF → extract → dual fingerprint → match/mismatch | `analyzeDocument` | **Yes** |
| F7 | Verification architecture (A/B/C overview) | 3 entry paths sharing chain authority | routes + methods | **Yes** |
| F8 | Trust boundary / data authority model | chain vs Supabase vs document vs browser | reconciliation code | **Yes** |
| F9 | Supabase reconciliation flow | row → chain lookup → keep/drop/override | `reconcileSupabaseRowsWithChain` | Yes |
| F10 | Certificate lifecycle / state machine | issue → active → revoked (+ pending branch) | contract status + pending registry | Yes |
| F11 | Revocation flow | super-admin → tx → status → post-checks | `revokeCertificate` + live-revoke-check | Yes (evidence prose-only) |
| F12 | IPFS upload data flow | browser → server fn (JWT) → Pinata → CID → chain | `ipfs.ts`/`pinata.ts` | Yes |
| F13 | End-to-end sequence diagram | issuance + verification combined | PART 4 of this audit | Yes |
| F14 | Threat model diagram | surfaces: wallet, RPC, DB, IPFS, server fn, UI | PART 14 | Yes (qualitative) |
| F15 | QR workflow (generation → scan → Method A) | payload format + routing | `QRCodeCard`, routes | Yes (annotate: in-app scanner NOT implemented) |

---

# PART 13 — PERFORMANCE EVALUATION (separated by area)

**A. Issuance performance** — LIVE, **testnet-only**, machine artifact: n=**1** (2026-10-16): fingerprint 1.74; pdf 33.55; ipfs 2117.72; prep 38.5; submit 1897.7; confirm 5232.65; supabase 1468.89; total **9328** ms. Prose baseline N=10 (2026-10-14, pre-fix code): total mean 48063.75 ms, confirm mean 44972.59 ms, 5/10 timeouts — **superseded, raw data gone, NOT comparable** [7 for current code].
**B. Confirmation performance** — prose: pending→confirmed @5.4 s (1 sample); Task-3 distribution 5–43 s for successes, 37–166 s for late mining (n=10, pre-fix). Constant: 60 s timeout [1]. **Current-code distribution NOT MEASURED** at n≥2.
**C. IPFS upload** — LIVE artifact: overall n=36 (mean 9508.25, median 3881.22, min 1070.15, max 54534.18, stdDev 12037.31); by size n=5 each (7 sizes). Baseline/live/testnet (Pinata).
**D. IPFS retrieval** — LIVE artifact: n=36 (mean 7181.63, median 7045.28, min 4593.96, max 11009.05, stdDev 1687.95); 36/36 first attempt; delayed recheck +652.7 s.
**E. Method A** — LIVE artifact: n=10, mean 6022.47 ms; search stage = 99.9% of time (O(n) scan dominates).
**F. Method B** — LIVE artifact: n=10, mean 6038.49 ms; 10/10 consistent with A.
**G. Method C** — LIVE artifact: n=10, mean 551.11 ms; registrySearch 549.39 ms ≈99.7%.
**H. Revocation** — one live revoke (prose). Latency **NOT MEASURED**; gas 60,932 (prose, n=4 across runs).
**I. Supabase operations** — insert 1468.89 ms (n=1 artifact). Select/update latencies **NOT MEASURED**.
**J. End-to-end latency** — 9328 ms (n=1 artifact); 8854.83 ms (prose, 1 sample); 48063.75 ms (prose, pre-fix N=10).

All measurements: **testnet (Polygon Amoy)**, public RPC `polygon-amoy-bor-rpc.publicnode.com`, no warm-ups (persisted harnesses), host hardware/browser **NOT RECORDED**. All classification: **live testnet**, production-like: **NO**; synthetic: only IPFS size-sweep payloads (deterministic mulberry32, no PII); offline: the 123 tests + `wrong-network-check` shim.

---

# PART 14 — SECURITY EVALUATION

| Threat / Attack | Attack surface | Expected defense | Actual result | Status | Evidence |
|---|---|---|---|---|---|
| Wrong-network signing (no-op tx mined as success) | wallet chainId | pre-signing `wrong_network` guard (issue + revoke) | script: typed error, only `eth_chainId` seen, 0 funds | **Fixed — prose-verified** | `certificates.ts:991-1002,1205-1210`; `wrong-network-check.ts`; `2026-10-16_152855.md` |
| Fake success via synthetic receipt (blockNumber 0) | confirmation machine | `isValidReceipt` requires blockNumber>0; timeout=pending | 29 tests incl. 4 synthetic-receipt cases: pending, never confirmed | **Fixed — unit-tested** | `confirmation.ts:126-147`; `transaction-confirmation.test.ts` |
| Timeout misclassified as success | 60 s race | final receipt lookup; pending if none | test #7, #9, #9b | **Fixed — unit-tested** | same |
| Supabase poisoning (wrong hash) | DB writes | `reconcileSupabaseRowsWithChain` drops mismatch | test #9 drops | **Fixed — unit-tested** | `supabase-integrity.test.ts` |
| Supabase metadata tamper (recipient/course/date) | DB reads | re-hash vs chain → drop / fingerprint gate | tests #3-5 false; Method C mismatch | **Fixed — unit-tested** + live prose | tests; `live-e2e-check` tamper |
| Re-keying (row id swapped) | DB reads | fingerprint includes certificateId → mismatch | tests #6,#7 false | **Fixed — unit-tested** | tests |
| Status poisoning (DB says active, chain says revoked) | DB reads | chain status overrides; update gated by on-chain hash eq | test #8, #13 | **Fixed — unit-tested** | tests |
| RPC-error fail-open keeps stale row | reconciliation | documented fail-open (availability over strictness) | test #12 keeps row — **documented residual risk** | **Accepted limitation** | tests + code comment |
| Unauthorized issuer registers | contract | `onlyAuthorizedIssuer` revert | **NOT unit-tested (no contract tests)**; login advisory check only; **no route guards** | **IMPLEMENTED — NOT TESTED** | contract; audit H-01/H-05 |
| Unauthorized revocation | contract | `onlySuperAdmin` | not contract-tested; app surfaces revert as `transaction_failed` | **IMPLEMENTED — NOT TESTED** | contract; `certificates.ts:1272-1281` |
| Duplicate registration | contract | "Certificate already exists" revert | not contract-tested | **IMPLEMENTED — NOT TESTED** | contract |
| Revoked-certificate presentation | verification | outcome `revoked` | live A/B revoked (prose); bench n=1 each (artifact) | **LIVE VERIFIED** | bench JSON `revoked`; `live-revoke-check` |
| Unknown hash | Method A | full-scan → `not_found` | 5/5 in 10.0–10.9 s | **LIVE VERIFIED (artifact)** | bench |
| Malformed hash / malformed QR / garbage file | A/B/C | format gates before network | 4/4, 4/4, 3/3, ≤0.56 ms | **LIVE VERIFIED (artifact)** | bench |
| PDF recipient/course/date/ID tampering | Method C | extraction + dual fingerprint | bench: 2/4 detected (pre-fix); live prose post-fix: 5/5 | **CONFLICTING — see C-5; re-run required** | bench + notes |
| Client-side secret leakage (Pinata JWT) | bundle | server-only module; `PINATA_JWT` not `VITE_` | 3 unit leak tests; bundle scan PASS (prose ×2); static scan findings [] | **Fixed — unit-tested + prose scans** | `ipfs-upload.test.ts` #16/20/23; Task 2/8 notes; bench `security` |
| Secret in git | repo | `.gitignore` `.env`; placeholders in `.env.example` | `.env` untracked [4]; Task 8 area A "VERIFIED SAFE" | **Verified [4]+prose** | `.gitignore`; `2026-10-16_002500.md` |
| Error/response detail leakage (IPFS) | server fn | sanitized messages | tests #16-19, #23 | **Unit-tested** | tests |
| XSS / dangerous sinks | UI | React escaping; only `dangerouslySetInnerHTML` is dev-controlled chart config | Task 8 area E "VERIFIED SAFE" (manual) | **Observed/manual — no automated XSS test** | `2026-10-16_002500.md` |
| Server-fn abuse (quota/cost) | upload endpoint | validation limits only — **no auth/rate limit** | unauthenticated pinning = open risk | **OPEN — REQUIRES EXTERNAL CONFIGURATION** | Task 8 area C; `rls-hardening.sql` notes |
| Supabase anon-key abuse (INSERT/UPDATE) | DB | proposed RLS only | **RLS not applied/verified** | **OPEN — REQUIRES EXTERNAL CONFIGURATION** | `supabase/rls-hardening.sql:5-10` |
| PII in logs | logging | structured logger w/o PII | test #13 (issuance-timing) asserts no recipientEmail/name/JWT strings | **Unit-tested** | tests |
| Dependency supply chain | deps | lockfile, no postinstall | **no advisory-DB audit performed** | **OPEN — REQUIRES EXTERNAL TOOLING** | Task 8 area I |
| Contract reentrancy/fund-drift | contract | no fund/external calls in contract | code inspection: none | **Observed [4]** | `CertChainRegistry.sol` |
| Log-scan denial (getLogs 10k cap) | RPC | `resolveRegistrationTx` receipt-verified fallback | fixed in code (prose 10-16); stored bench still 0/10 | **Fixed — re-benchmark needed** | `certificates.ts:88-160` |

---

# PART 15 — TAMPERING / ADVERSARIAL EVALUATION MATRIX

Only populated where actually tested. ✅ = detected as expected; ❌ = not detected; — = not tested in that method.

| Attack / tampering case | Method A | Method B | Method C | Expected | Actual (evidence) | Detected? |
|---|---|---|---|---|---|---|
| Recipient modified in PDF | — (A never sees file) | — | bench 536.68 ms → `match`; **live prose → `mismatch`** | mismatch | **conflicting** (C-5) | **Artifact: NO; Post-fix prose: YES** |
| Course modified in PDF | — | — | bench 531.51 → `match`; live prose → `mismatch` | mismatch | conflicting | **Artifact: NO; prose: YES** |
| Issue date modified in PDF | — | — | 516.45 → `mismatch` | mismatch | yes | **YES (artifact)** |
| Certificate ID modified in PDF | — | — | 402.05 → `not_found` | not_found/mismatch | yes | **YES (artifact)** |
| Recipient/course/date/ID in Supabase row | — | — | (via fingerprint #1) | mismatch | offline: detected (3-6) | **YES (unit)** |
| Unknown certificate ID (doc) | — | — | `not_found` | not_found | bench + live | **YES** |
| Malformed PDF bytes | — | — | incomplete → `not_found` (0.56/0.2/0.08 ms) | not_found | 3/3 | **YES (artifact)** |
| Empty file | `not_found` (unit) | — | `not_found` | not_found | tests | **YES (unit)** |
| Unknown hash | `not_found` 5/5 (10.0–10.9 s) | same | n/a | not_found | artifact | **YES** |
| Malformed hash | `invalid_hash` 4/4 (≤0.23 ms) | same (QR 4 cases) | n/a | invalid_hash | artifact | **YES** |
| Malformed QR payload | n/a | 4 cases → malformed/invalid | n/a | reject | artifact | **YES** |
| Chain-only certificate (no DB row) | `verified`, metadata `absent` | same | `not_found` (metadata unavailable) | documented behavior | artifact | **N/A — honest handling** |
| Revoked certificate | `revoked` | `revoked` | `match` + status revoked | revoked | artifact n=1 + live prose | **YES** |
| Supabase hash mismatch | fingerprint check fails (reported) | same | fingerprint #1 fails → mismatch | detect | unit tests 9/11 | **YES (unit)** |
| Synthetic receipt / fabricated confirmation | n/a (verifier is read-only) | n/a | n/a | pending/invalid | 29 unit tests | **YES (unit)** |
| Wrong-network signing attempt | n/a | n/a | n/a | typed error pre-signing | shim script ALL PASS (prose) | **YES (prose)** |

---

# PART 16 — TEST CASE MATRIX FOR IEEE (publication-ready; consolidated, not inflated)

Consolidation rule: same-scenario variants (e.g., 4 malformed-hash shapes) are one row; exact per-test names are in PART 9. `TC-U` = offline unit/robustness (outcome prose-recorded as passing), `TC-B` = benchmark scenario (machine artifact), `TC-L` = live script (prose-recorded).

| TC ID | Category | Test case | Input | Expected | Actual | Pass/Fail | Evidence |
|---|---|---|---|---|---|---|---|
| TC-FUN-01 | Functional | Fingerprint canonical string & protocol vector | canonical metadata | `0x`+SHA-256(UTF-8 canonical) | matches independent WebCrypto oracle | P (prose) | `certificate-fingerprint.test.ts` #1,10 |
| TC-FUN-02 | Functional | Legacy fingerprint compatibility | legacy formula | equal fingerprints | equal | P (prose) | same #11 (+ 24/24 live prose) |
| TC-FUN-03 | Functional | PDF round-trip extraction of all 4 fields | generated PDF | 4/4 fields | complete=true | P (prose) | `method-c-extraction.test.ts` #1-2 |
| TC-FUN-04 | Functional | Method A verifies registered hash | live hash | verified | **10/10 verified** | **P (artifact)** | bench `methodA` |
| TC-FUN-05 | Functional | Method B consistent with A | QR payload | same outcome | **10/10** | **P (artifact)** | bench `methodB` |
| TC-FUN-06 | Functional | Method C matches genuine document | real PDF | match | **10/10** | **P (artifact)** | bench `methodC` |
| TC-FUN-07 | Functional | Full issuance end-to-end | form data | anchor + row + receipt | 1 live run, total 9328 ms | **P (artifact, n=1)** | issuance JSON |
| TC-FUN-08 | Functional | Live E2E 42-check suite | cert `CERT-2026-273168` | all pass | **42/42 PASS** | P (prose) | `2026-10-16_152855.md` |
| TC-BLK-01 | Blockchain | Receipt with status 1, block>0 → confirmed | fabricated receipt | confirmed | confirmed | P (prose) | confirmation test #3 |
| TC-BLK-02 | Blockchain | Receipt status 0 → failed | fabricated | failed | failed | P (prose) | #4, #23 |
| TC-BLK-03 | Blockchain | Cancelled replacement → failed | error object | failed | failed | P (prose) | #13 |
| TC-BLK-04 | Blockchain | Pending → confirmed on-chain transition | live self-transfer | confirmed | confirmed block 50247727 @5.4 s | P (prose) | `live-confirmation-check` |
| TC-BLK-05 | Blockchain | Revocation pre/post state | live cert | revoked everywhere | tx block #50321993 | P (prose) | `live-revoke-check` |
| TC-SEC-01 | Security | Synthetic blockNumber:0 receipt never confirms | fabricated | pending | pending (4 variants) | P (prose) | tests #2,8,9,26 |
| TC-SEC-02 | Security | Timeout never = success | 1 ms/30 ms timeouts | pending | pending | P (prose) | tests #7,9,24 |
| TC-SEC-03 | Security | Wrong-network guard blocks issue & revoke | shim chainId 0x1 | typed `wrong_network`, 0 tx | ALL PASS (prose) | P (prose) | `wrong-network-check.ts` |
| TC-SEC-04 | Security | Supabase poisoned hash dropped | wrong hash row | dropped | dropped | P (prose) | supabase test #9 |
| TC-SEC-05 | Security | Supabase re-keyed row rejected | changed id | mismatch | mismatch | P (prose) | test #6 |
| TC-SEC-06 | Security | Chain status overrides DB status | active row / revoked chain | revoked | revoked | P (prose) | test #8 |
| TC-SEC-07 | Security | No secret leakage on Pinata errors | 401/500 responses | generic message | no JWT leak | P (prose) | ipfs tests #16,20,23 |
| TC-SEC-08 | Security | Invalid file rejected before network | `.txt` file | no fetch call | fetchCalled=false | P (prose) | ipfs test #21 |
| TC-SEC-09 | Security | Structured logs contain no PII | full success run | no recipient/JWT fields | regex clean | P (prose) | timing test #13 |
| TC-SEC-10 | Security | Static secret patterns in 6 files | source scan | no findings | findings [] | **P (artifact)** | bench `security` |
| TC-SEC-11 | Security | Client bundle free of PINATA_JWT/PRIVATE_KEY | built bundle | absent | PASS (prose ×2) | P (prose) | Task 2/8 notes |
| TC-NEG-01 | Negative | Empty/short/non-hex hash | 3 shapes | invalid_hash | 4/4 ≤0.23 ms | **P (artifact)** | bench `malformedHash` |
| TC-NEG-02 | Negative | Unknown hash → not_found | 5 hashes | not_found | 5/5 | **P (artifact)** | bench `unknownHash` |
| TC-NEG-03 | Negative | Garbage files → not_found | text/png/empty | not_found | 3/3 | **P (artifact)** | bench `garbageInputs` |
| TC-NEG-04 | Negative | Malformed QR payload | 4 payloads | reject | 4/4 | **P (artifact)** | bench `malformedQr` |
| TC-NEG-05 | Negative | Upload validation suite | 8 invalid forms | typed rejections | all reject | P (prose) | ipfs tests #4-11 |
| TC-NEG-06 | Negative | Missing extraction fields → incomplete | PDFs w/o name/course | complete=false | complete=false | P (prose) | method-C tests #8-9,12 |
| TC-REV-01 | Verification | Revoked cert → revoked across methods | revoked cert | revoked/match+revoked | observed | **P (artifact)** | bench `revoked` |
| TC-TAM-01 | Tampering | Issue-date tamper in PDF | modified byte | mismatch | mismatch (516.45 ms) | **P (artifact)** | bench `tamper[0]` |
| TC-TAM-02 | Tampering | Certificate-ID tamper in PDF | modified byte | not_found | not_found (402.05 ms) | **P (artifact)** | bench `tamper[3]` |
| TC-TAM-03 | Tampering | Recipient tamper in PDF | modified byte | mismatch | **`match` (bench) vs `mismatch` (live prose)** | **CONFLICT — re-run** | bench `tamper[1]`; `2026-10-15_235500.md` |
| TC-TAM-04 | Tampering | Course tamper in PDF | modified byte | mismatch | **`match` (bench) vs `mismatch` (live prose)** | **CONFLICT — re-run** | bench `tamper[2]` |
| TC-TAM-05 | Tampering | Metadata tamper in Supabase rows | 4 field mutations | fingerprint mismatch | detected | P (prose) | supabase tests #3-5 |
| TC-TAM-06 | Tampering | Fingerprint single-char sensitivity | 1-char change | different fp | different | P (prose) | fingerprint test #17 |
| TC-IPF-01 | IPFS | Upload success rate | 39 uploads | all succeed | **39/39** | **P (artifact)** | ipfs JSON `reliability.upload` |
| TC-IPF-02 | IPFS | Retrieval first-attempt | 36 fetches | all succeed | **36/36** | **P (artifact)** | `retrievalFirstAttempt` |
| TC-IPF-03 | IPFS | Byte-identical integrity | 36 SHA-256 comparisons | equal | **36/36** | **P (artifact)** | `integrity` |
| TC-IPF-04 | IPFS | Dedup: same content → same CID | 2 identical uploads | equal CID | equal | **P (artifact)** | `repeatedUploads` |
| TC-IPF-05 | IPFS | Error probes (unknown CID etc.) | 4 probes | safe failures | 4/4, no secret leak | **P (artifact)** | `errorProbes` |
| TC-FIN-01 | Fingerprint | 3-way consistency recompute | 23 certs | all equal | **23/23** | **P (artifact)** | bench `fingerprintConsistency` |
| TC-FIN-02 | Fingerprint | Compat audit stored+chain | 24 rows | match | **24/24+24/24** | P (prose) | `check-fingerprint-compat` |

---

# PART 17 — EXPERIMENTAL SETUP

| Parameter | Configuration |
|---|---|
| Blockchain network | Polygon Amoy **TESTNET** |
| Chain ID | 80002 (`0x13882`) |
| Contract | `CertChainRegistry` @ `0x09921D25cB513793e17082Cce0fB4F520f0CDF50` (deployed 2026-08-31T06:04:59.550Z) |
| Deployer/super-admin | `0x3e72b748a543DEc762a297F7304A04F980d7bC01` |
| RPC (measured work) | `https://polygon-amoy-bor-rpc.publicnode.com` (public, free tier) |
| Log-scan RPC (eval-metrics only) | `https://polygon-amoy.gateway.tenderly.co` |
| Gas policy | `maxPriorityFeePerGas` 30 gwei; `maxFeePerGas` 50 gwei (fixed) |
| Confirmation timeout | 60,000 ms (`CONFIRMATION_TIMEOUT_MS`) |
| Frontend | TanStack Start 1.168.32 / Router 1.170.18 / React 19 / Vite 8 / TS 5.8 |
| Runtime/package manager | **Bun** (`bun test`, `bun scripts/bench-*.ts`); Node also required by README |
| Browser | MetaMask-injected (issuance); read-only verification without wallet. **Specific browser/version NOT RECORDED** |
| OS/host hardware | **NOT RECORDED — NOT AVAILABLE FROM CURRENT PROJECT EVIDENCE** |
| Supabase | project `hpwmfetsiwbmnrxdjfok.supabase.co` (URL in code), anon key; single `certificates` table; **RLS NOT VERIFIED** |
| Pinata | JWT server-side (`PINATA_JWT`), pinFileToIPFS endpoint |
| IPFS gateway | `https://gateway.pinata.cloud/ipfs/<cid>` |
| Benchmark sample sizes | IPFS 36 cycles (+3 dedup, 4 probes, 1 delayed); verification 10/method + negatives (5/4/4/2/4/3) + 23 consistency; issuance **1** |
| Methodology | `performance.now()` per stage; no warm-ups (persisted harnesses; eval-metrics used 2); pauses 250/300 ms between cycles/calls; retrieval retries 3×/2500 ms; no cleanup of on-chain certs; IPFS unpin cleanup 37/39 |
| Test data | deterministic synthetic bytes (mulberry32, no PII) for IPFS sweep; app-generated certificates with `CERT-YYYY-NNNNNN` ids for verification |
| Retry/timeout behavior | ethers `withRetry` 4 attempts (verification bench); 60 s retrieval timeout; 60 s confirmation; exit-1 on any failed check |
| Testnet limitations | free public RPC (10k-block getLogs cap; rate limiting observed as HTTP 429 in one eval run); faucet-dependent funds; no finality guarantees of mainnet |

---

# PART 18 — BASELINE / COMPARISON ANALYSIS

- **Baseline comparison (old vs new implementation):** partially exists as *prose* only — tamper 2/4 (artifact, pre-Task-7) vs 5/5 (prose, post-fix); getLogs 0/10 (artifact) vs fixed (prose). **The before/after pair is not symmetric (one side always prose) → NO VALID PERSISTED COMPARATIVE EXPERIMENT AVAILABLE.**
- **Conventional database vs blockchain / centralized vs decentralized verification performance:** **NO VALID COMPARATIVE EXPERIMENT AVAILABLE.** No such experiment exists anywhere in the repository.
- **Existing system vs proposed system:** qualitative/design-level only; any table must be marked as a design comparison, not measured.
- **Performance comparison against related work:** **NOT AVAILABLE FROM CURRENT PROJECT EVIDENCE** (no cross-system measurements; literature values come from other papers with different setups).
- **Statistical significance of any difference:** **NOT MEASURED** — no statistical tests exist; do not claim significance.
- Suggested future experiments (separate section in the paper): persisted issuance n≥10; centralized-DB lookup baseline vs chain scan on identical hardware/network; O(n) scan scaling with controlled registry sizes (persisted); gas across registration volume; multi-RPC comparison.

---

# PART 19 — RESEARCH CONTRIBUTIONS (evidence-based, no marketing)

| # | Contribution statement | Supporting implementation | Supporting experiment | Evidence | Strength |
|---|---|---|---|---|---|
| R1 | A fully specified, deterministic **canonical metadata fingerprint protocol** (field order, separator, trimming, date normalization, UTF-8, SHA-256) with proven byte-compatibility with legacy on-chain records | `src/lib/certificate-fingerprint.ts` | 20 unit tests (protocol vector, determinism, unicode, date forms); compat audits 12/12+12/12 and 24/24+24/24 | tests + notes | **STRONGLY SUPPORTED** (protocol correctness); backward compat partially prose |
| R2 | Explicit **hash-domain separation** between metadata fingerprint (registry key) and document byte hash, resolving the metadata-vs-bytes verification flaw | code comments + `certificate-fingerprint.ts` + `analyzeDocument` | domain-separation unit test (`verification.test.ts` #10); Method C never compares byte hash | code + test | **STRONGLY SUPPORTED** |
| R3 | **Chain-authoritative reconciliation** treating the off-chain DB as untrusted: drop unanchored rows, drop hash mismatches, chain status override, fingerprint-gated display | `reconcileSupabaseRowsWithChain` et al. | 14 offline tests incl. poisoning/re-keying/status cases; live 24/24 anchored (prose) | code + tests | **STRONGLY SUPPORTED** (offline); live partial |
| R4 | **Three-state transaction confirmation semantics** banning synthetic receipts (timeout=pending, blockNumber>0 requirement) | `src/lib/blockchain/confirmation.ts` | 29 unit tests; live pending→confirmed observation (prose) | code + tests | **STRONGLY SUPPORTED** |
| R5 | **Three verification methods** with measured latency and negative-case behavior on a real testnet registry | Methods A/B/C code | n=10 per method + negatives artifact (2026-10-15) | bench JSON | **STRONGLY SUPPORTED** (testnet, small n) |
| R6 | **Dual-fingerprint document verification** (registry integrity + document identity) with label-anchored extraction | `extract-certificate-metadata.ts` + `analyzeDocument` | 14 unit tests; live 5/5 (prose); bench 2/4 pre-fix (artifact) | mixed | **PARTIALLY SUPPORTED** — tamper rate conflict must be resolved by re-run |
| R7 | **Wrong-network signing guard** preventing no-op-tx false success | `certificates.ts` guards | shim script (prose PASS, 0 funds) | code + script | **PARTIALLY SUPPORTED** (script output prose-only; no unit test) |
| R8 | **IPFS reliability baseline** on Pinata: 100% upload/retrieval/integrity over 36–39 real cycles with per-size latency | `bench-ipfs.ts` | persisted artifact | bench JSON | **STRONGLY SUPPORTED** (one gateway, one day, testnet-era infra) |
| R9 | **Security posture documentation**: server-only secrets, validated upload proxy, no secret patterns in scanned files | server module + tests + audit | 3 leak tests + static scan findings [] + bundle scans (prose) | mixed | **PARTIALLY SUPPORTED** — no external audit, no contract tests |
| R10 | Reproducible evidence discipline itself (every claim tagged, conflicts registered) | this audit + `context_md/` | — | this document | **DESIGN CONTRIBUTION** (process, not system) |
| — | Novelty over prior blockchain-diploma systems | — | — | **related-work comparison NOT DONE** | **FUTURE WORK ONLY** |
| — | Scalability/throughput characteristics | O(n) scan in code | eval-metrics fits (prose, k≤16) | unpersisted | **FUTURE WORK ONLY** (re-run + persist) |
| — | Production readiness / formal security guarantees | — | — | — | **FUTURE WORK ONLY** |

---

# PART 20 — LIMITATIONS

| Limitation | Technical cause | Impact | Evidence | Possible future improvement |
|---|---|---|---|---|
| Testnet-only (Polygon Amoy) | deployment choice | no production finality/economics; results don't transfer | `deployment.json` | redeploy to mainnet/L2 after audits |
| Public free RPC dependency | publicnode URL; 10k-block getLogs cap; observed 429 | latency variance; log-scan failures (0/11 prose) | `contracts.ts:24-31`, notes | paid RPC / indexed log provider |
| Linear registry scan O(n) | no hash index in contract; client enumerates `certificateIds` | verification latency ~6 s already at n≈28 (search stage 99.9%) | contract + bench stageStats | new contract version with mapping-by-hash/index |
| IPFS gateway latency/reliability | single Pinata gateway; retrieval mean 7.2 s | Method C isn't affected (no fetch), but doc retrieval is slow | ipfs JSON | multiple gateways; in-app retrieval |
| Method C text-based scope | raw-byte regex, no OCR | scanned/image PDFs → not_found; image uploads useless | `extract-certificate-metadata.ts:32-35` | OCR pipeline |
| QR not in PDF; no in-app scanner | `qrCodeDataUrl` never passed; verify panel mock | "scan the QR" story requires an external phone camera | code grep [4] | embed QR in PDF; add scanner lib |
| Supabase RLS not verified/applied | proposal file only | anon key could insert/update hostile rows **if** API open | `rls-hardening.sql:5-10` | apply hardened SQL (staging first) |
| Unauthenticated IPFS upload endpoint | single server fn, no auth/rate limit | quota/cost abuse | Task 8 area C | auth + rate limiting + quota alerts |
| In-memory pending registry | module `Map`, session-scope | pending issuance lost on reload; no auto-retry | `pending-transactions.ts:6-14` | persistent queue + polling |
| One-shot pending recheck | manual button, no polling loop | user must click to learn outcome | `issue.tsx:103-127` | background poller |
| Small benchmark samples | n=10/method, n=1 issuance, n=36 IPFS | no percentile/tail claims; no significance | bench JSONs | re-run n≥30 |
| No warm-ups in persisted harnesses | harness design | possible cold-start inflation | scripts | add warm-up + record |
| No contract tests / no external audit | never built | authz claims rest on code reading only | `test/` inventory | Hardhat test suite + Slither |
| Chain event log limitations | `CertificateRevoked` never queried; no subscriptions | revocation tx hashes unrecoverable; no live event feeds | code grep [4] | event indexer |
| Integrity envelope is 4 fields | fingerprint inputs | email, certificate type, PDF layout, recipient email **not anchored** | protocol spec | extend canonical string (breaks compat → versioned protocol) |
| Outcome semantics (L9) | `verified` returned whenever hash found even if checks fail | UI can say "verified" while an individual check shows failure | `certificates.ts:850-855` | fold checks into outcome |
| No route guards | no `beforeLoad` auth | dashboards publicly reachable (UX/auth gap) | grep [4] | add guards (UX only; chain is real control) |
| Host/monitoring gaps | NetworkStatus hard-coded "Connected"; dashboard "Verified" = has-txHash | misleading UI signals | `NetworkStatus.tsx:4-13`; `dashboard.index.tsx:55` | fix labels/probe |
| Registry counts drift | chain grows between sessions | any published count is stale | conflict C-3 | date-stamp + re-measure before submission |
| Email/batch-export/settings simulated | toasts | demo-only features | code | implement or omit from paper |
| Old raw baselines deleted | Task 6 cleanup | historical N=10 issuance unverifiable | notes | never delete raw logs; re-run |

---

# PART 21 — REMAINING RISKS / PRODUCTION READINESS

**FIXED (code-level, with evidence):**
1. Client-exposed Pinata JWT (`VITE_PINATA_JWT`) → server-only (tests + bundle scans) [1][3].
2. Fake-success confirmation (`blockNumber:0`, timeout=success) → 3-state machine (29 tests) [1][3].
3. Wrong-network signing → pre-signing guard [1] (script prose [2p]).
4. Supabase metadata/status poisoning → reconciliation + gating (14 tests) [1][3].
5. Hash-domain mismatch (metadata vs bytes) → canonical protocol + domain separation [1][3].
6. Method C extraction weakness → label-anchored extractor + dual fingerprint [1] (live 5/5 prose [2p]).
7. `getLogs` failure → receipt-verified `resolveRegistrationTx` fallback [1] (needs re-benchmark).

**OPEN (code/design):**
- No contract test suite; no external security audit; no dependency advisory scan.
- O(n) verification scan; outcome semantics L9; no route guards; UI mislabels ("Verified", "Connected"); QR-not-in-PDF; no in-app scanner; in-memory pending registry; revocation tx not recovered; integrity envelope = 4 fields; dead prototype module (`certiproof.ts`) still in tree.
- Uncommitted working tree (all Tasks 1–10) — reproducibility risk [4].

**REQUIRES EXTERNAL CONFIGURATION:**
- Supabase RLS application (proposal file only) [8].
- Edge rate-limiting + Pinata JWT quota alerts [8].
- Pinata JWT rotation decision/status (never recorded; historical exposure) [8].
- Paid/monitored RPC + log-indexing service [8].

**FUTURE WORK:**
- OCR; QR embedding/scanning; persistent pending queue; contract v2 (hash index, issuer revocability); comparative experiments; mainnet deployment; CI.

**Production-readiness verdict:** **NOT production-ready.** Testnet-proven prototype with strong internal engineering evidence; external security configuration, contract testing, and re-measured benchmarks are prerequisites for any such claim.

---

# PART 22 — CLAIM AUDIT: "DO NOT MAKE UNSUPPORTED CLAIMS"

| Claim | Verdict | Why unsupported |
|---|---|---|
| "100% secure" / "fraud-proof" / "unforgeable" | **FORBIDDEN** | No formal proof, no external audit, no contract tests; unauthorized-issuer path never adversarially tested |
| "100% reliable" | **FORBIDDEN as universal** | Only bounded observations: IPFS 39/39 & 36/36 (one gateway, one day), verification 10/10 (n=10). Always state numerator/denominator + environment |
| "Tamper-proof" | **FORBIDDEN** | Stored artifact shows **2/4** tamper detection (pre-fix); integrity covers only 4 metadata fields; byte-level edits outside extracted fields undetected |
| "Immutable certificate system" (unqualified) | **FORBIDDEN** | Supabase is mutable; chain portion immutable but only status field changes; revocation is by design |
| "Scalable" | **FORBIDDEN** | O(n) scan; measured ~6 s at n≈28; fits only up to n=16 and unpersisted |
| "Production-ready" | **FORBIDDEN** | Testnet only; RLS unapplied; no auth on upload; no audit |
| "Zero latency" / "real-time verification" | **FORBIDDEN** | Measured mean ~6.0 s (A), ~0.55 s (C), unknown hash ~10.4 s |
| "Sub-second verification" | **FORBIDDEN for A/B** | Only Method C is sub-second (551 ms mean) |
| "AI-powered" | **FORBIDDEN** | No AI component exists anywhere |
| "Fully decentralized" | **FORBIDDEN** | Centralized Pinata account, centralized Supabase, single super-admin, single public RPC; only the anchoring layer is on a public chain |
| "Decentralized" (even qualified) | **QUALIFY** | Say "anchored on a public blockchain (Polygon Amoy testnet)" |
| "Accuracy = X%" | **FORBIDDEN** | The project never measured classification accuracy; use "detection outcomes on N executed cases" |
| "Statistically significant" | **FORBIDDEN** | No statistical analysis exists |
| "Gas cost 0.001–0.005 POL" / "issuance 15–30 s" / "verification 3–8 s" / "upload 5–10 s" | **FORBIDDEN** (audit C-01) | Not supported by persisted measurements (measured: verification ~6.0 s, upload mean 9.5 s, registration ≈0.007236 POL prose) |
| "Verified by blockchain" for academic truth | **FORBIDDEN** | Chain proves data integrity/registration, not that the credential is academically genuine (audit M-06) |
| "IPFS guarantees permanence/confidentiality" | **FORBIDDEN** | Public content; Pinata-pin dependent (audit M-01) |
| "QR scanning in the app" | **FORBIDDEN** | Scanner not implemented [6] |
| "Email delivery" / "batch export" / "settings persistence" | **FORBIDDEN** | Simulated toasts [1] |
| Any certificate count without a date | **FORBIDDEN** | Registry changed 9→10→11→16→28 across sessions (C-3) |
| "Method C detects recipient/course tampering" (as measured) | **FORBIDDEN until re-run** | Artifact says 2/4; prose says 5/5 (C-5) |

---

# PART 23 — EXACT EVIDENCE MAP

| Research claim | Evidence type | File / script / test | Result |
|---|---|---|---|
| Fingerprint = SHA-256 of 4-field canonical string, `0x`+64 lowercase | unit (protocol vector) | `test/certificate-fingerprint.test.ts` #10 | matches WebCrypto oracle (prose pass) |
| Fingerprint backward-compatible with legacy records | live compat audit | `scripts/check-fingerprint-compat.ts` | 12/12+12/12 (10-14); **24/24+24/24 (10-16)** [prose] |
| Method A verifies registered certificates | benchmark artifact | `benchmarks/verification-results.json` `methodA` | **10/10 verified; mean 6022.47 ms** |
| Method B agrees with Method A | benchmark artifact | `methodB.consistencyVsMethodA` | **10/10 (100%)** |
| Method C matches genuine documents | benchmark artifact | `methodC` | **10/10 match; mean 551.11 ms** |
| Unknown hash → not_found | benchmark artifact | `negatives.unknownHash` | **5/5, 10015–10926 ms** |
| Malformed hash → invalid_hash without network | benchmark + unit | `negatives.malformedHash`; `verification.test.ts` #1-3 | **4/4 ≤0.23 ms**; unit pass |
| Garbage/empty files handled | benchmark + unit | `negatives.garbageInputs`; tests #8-9 | **3/3 not_found ≤0.56 ms** |
| Issue-date & certificate-ID tampering detected by Method C | benchmark artifact | `negatives.tamper[0],[3]` | mismatch @516.45 ms; not_found @402.05 ms |
| Recipient/course tampering detection | **conflicting** | `negatives.tamper[1],[2]` vs `context_md/2026-10-15_235500.md` | **artifact 2/4 vs prose 5/5 — RE-RUN REQUIRED** |
| IPFS upload reliability | benchmark artifact | `benchmarks/ipfs-results.json` `reliability.upload` | **39/39 (100%)** |
| IPFS retrieval reliability | artifact | `retrievalFirstAttempt` | **36/36 (100%)** |
| IPFS content integrity | artifact | `integrity` | **36/36 byte-identical (SHA-256)** |
| Content-addressed deduplication (observed) | artifact | `repeatedUploads` | same CID for identical file |
| Pending is never success | unit | `transaction-confirmation.test.ts` #7,9,24,25 | pending classification (prose pass) |
| Synthetic receipts rejected | unit | tests #2,8,9,26 | blockNumber 0 → pending |
| 60 s timeout is fixed baseline | unit | test #1 | `CONFIRMATION_TIMEOUT_MS === 60_000` |
| Live pending→confirmed | live script (prose) | `scripts/live-confirmation-check.ts` | block 50247727 @t+5.4 s |
| Wrong-network protected with zero funds spent | live shim (prose) | `scripts/wrong-network-check.ts` | ALL PASS; only `eth_chainId` seen |
| Revocation works end-to-end | live script (prose) | `scripts/live-revoke-check.ts` | tx `0xfd8fa7f8…` block #50321993; A/B revoked; C match+revoked |
| Supabase rows all chain-anchored | live script (prose) | `scripts/live-e2e-check.ts` (Task 10) | 42/42 checks; 24/24 anchored |
| Supabase poisoning defenses | unit | `supabase-integrity.test.ts` #9,11,13 | poisoned/unanchored rows dropped |
| Supabase re-keying detected | unit | test #6 | fingerprint mismatch |
| Secrets absent from scanned source | benchmark artifact | `verification-results.json` `security` | findings [] (5 patterns × 6 files) |
| Secrets absent from client bundle | live scan (prose) | Task 2 / Task 8 gates | PASS |
| No secret leakage via IPFS errors | unit | `ipfs-upload.test.ts` #16,20,23 | generic messages |
| Issuance single-run timing | benchmark artifact | `benchmarks/issuance-results.json` | total 9328 ms (n=1) |
| Gas per registration ≈241k units | live receipt stats (prose) | `scripts/eval-metrics.ts` runs 10-08/11/14 | mean 241,189 (n=16, 10-14) |
| Blockchain Record check previously failing | benchmark artifact | `methodA.runs[*].blockchainRecordPass` | 0/10 (pre-fix) |
| Blockchain Record fixed | code + prose | `certificates.ts:135-158`; `2026-10-16_152855.md` | receipt-verified fallback; re-benchmark needed |
| Chain is authority, DB untrusted | code | `certificates.ts:274-281` + recon functions | implemented |
| RLS not applied | proposal file | `supabase/rls-hardening.sql:5-10` | self-declared proposal |
| In-app QR scanner absent | code grep | `verify.tsx:144-170`; no scanner lib | decorative mock only |
| QR not embedded in PDF | code | `certificates.ts:1030-1039` (no `qrCodeDataUrl`) | optional branch never called |
| No route guards | code grep | 0 `beforeLoad\|redirect` | true |
| Contract has no fund-moving logic | source read | `CertChainRegistry.sol` | verified (179 lines) |
| Test suite = 123 offline tests | count [4] | `test/` grep | 123 `test()`, 28 `describe()`, 0 skips |
| Suite passes | prose only | context notes 10-16 | "123 pass / 0 fail (×2)" — not re-run |

---

# PART 24 — PAPER-READY RESULTS DATASET (verified numbers only)

**Environment (all):** Polygon Amoy testnet (chainId 80002); contract `0x09921D25cB513793e17082Cce0fB4F520f0CDF50`; RPC `https://polygon-amoy-bor-rpc.publicnode.com`; gateway `https://gateway.pinata.cloud/ipfs`; Bun runtime; measurement = `performance.now()`; no warm-ups (persisted harnesses).

**Verification latency (ms) — source `benchmarks/verification-results.json`, 2026-10-15T17:36:44.832Z, live read-only, n=10 each:**

| Method | Min | Median | Mean | Max | StdDev | Outcome rate |
|---|---:|---:|---:|---:|---:|---|
| A (hash) | 2707.02 | 6097 | 6022.47 | 8006.71 | 1678.63 | 10/10 verified |
| B (QR) | 2723.02 | 6062.79 | 6038.49 | 7977.36 | 1713.07 | 10/10 consistent with A |
| C (document) | 515.15 | 544.2 | 551.11 | 624.44 | 32.66 | 10/10 match |

Stage means (ms): A validate 0.39, provider 0.2, contract 2.24, searchAndDecision 6019.64; C readAndByteHash 1.34, extractFields 0.07, registrySearch 549.39, compareAndDecision 0.32.

**Negative-case latency (ms), same file:** unknown hash n=5: 10015.06, 10926.37, 10308, 10259.37, 10297.76 (all not_found); malformed hash n=4: 0.23/0.03/0.01/0.01 (all invalid_hash); malformed QR n=4: 0.01/0/0/0.01; garbage n=3: 0.56/0.2/0.08 (not_found); chain-only: A 1617.05 (verified), C 532.64 (not_found); revoked: A 3364.66 (revoked), B 3260.29 (revoked), C 594.85 (match+revoked); tamper n=1 each: date 516.45 (mismatch), recipient 536.68 (match), course 531.51 (match), id 402.05 (not_found).

**Reliability rates (as stored, with denominators):** Method A 10/10; Method B 10/10; Method C 10/10; unknown-hash not_found 5/5; malformed-hash 4/4; **tamper 2/4 (50%, pre-fix)**; fingerprint 3-way consistency 23/23; IPFS upload 39/39; retrieval first-attempt 36/36; integrity 36/36; error probes 4/4; unpin cleanup 37/39; secret scan 0 findings.

**IPFS latency (ms), 2026-10-15T16:18:02.772Z, n=36:**

| Metric | Min | Median | Mean | Max | StdDev |
|---|---:|---:|---:|---:|---:|
| Upload | 1070.15 | 3881.22 | 9508.25 | 54534.18 | 12037.31 |
| Retrieval | 4593.96 | 7045.28 | 7181.63 | 11009.05 | 1687.95 |

Upload mean by size (n=5): 10KB 1154.14; 100KB 1400.51; 500KB 2540.10; 1MB 4106.02; 2MB 7517.13; 5MB 20527.66; 10MB 30805.56. Retrieval mean by size: 6598.31 / 5445.85 / 6211.91 / 7106.93 / 8354.96 / 8067.88 / 8703.52. Certificate PDF (4795 B): upload 2041.45, retrieval 6091.88; delayed recheck +652739.15 ms → 6535.42 ms, integrity true.

**Issuance (ms), 2026-10-16T08:11:24.156Z, n=1:** fingerprint 1.74; pdf 33.55; ipfs 2117.72; prep 38.5; submit 1897.7; confirm 5232.65; supabase 1468.89; total 9328; QR micro 136.43. **(stdDev 0 = n=1 convention, not measured).**

**Prose-only (label as recorded observations with date):** issuance N=10 pre-fix total mean 48063.75 ms (2026-10-14); gas registration mean 241,189 units, n=16, range 240,060–257,964, ≈0.007236 POL @30 gwei (2026-10-14); revocation gas 60,932 (n=4); chain-only verification registered 3177.4 ms / missing 7399.6 ms (n=10+10, 2 warm-ups); O(n) fit 411.6·n+389.4 (k≤16); throughput 0.31 reg/s; SHA-256 0.264 ms (N=1000); jsPDF 11.0 ms (N=5); deployment cost ≈0.043 POL; live 42/42; compat 24/24+24/24; confirmation block 50247727 @5.4 s; Method C live 5/5.

**Explicitly NOT MEASURED:** accuracy; percentiles p95/p99; statistical significance; Supabase select/update latency; revocation latency; wrong-network latency; PDF-generation distribution (current code); throughput at scale; multi-chain/multi-RPC comparisons; mainnet numbers.

---

# PART 25 — PAPER TABLE RECOMMENDATION (ranked, final structures)

**PRIORITY A — Strongly recommended**

TABLE I. SYSTEM TECHNOLOGY STACK *(T1 — READY: from package.json/configs)*
| Layer | Technology | Version | Role |
|---|---|---|---|
| Frontend | TanStack Start/Router, React, TypeScript, Tailwind | 1.168/1.170, 19, 5.8, 4 | UI + SSR |
| Blockchain | Polygon Amoy / Solidity / ethers.js / Hardhat | 80002, ^0.8.24, v6, 2.x | anchoring |
| Storage | IPFS via Pinata; Supabase (PostgreSQL) | — | document; display metadata |
| Crypto | SHA-256 (Web Crypto API) | — | fingerprint |
| PDF/QR | jsPDF, qrcode | 4.2.1, 1.5.x | certificate + QR |

TABLE II. SMART CONTRACT FUNCTIONALITY *(T2 — READY; use PART 5's 11-row table)*

TABLE III. TRUST MODEL: BLOCKCHAIN-AUTHORITATIVE VS OFF-CHAIN AUXILIARY *(T4 — READY; use PART 6's three-band split)*

TABLE IV. FINGERPRINT AND INTEGRITY MECHANISMS *(T6 — READY; use PART 7's table)*

TABLE V. VERIFICATION METHODS COMPARISON *(T7 — READY)*
| Method | Input | Chain read | Supabase read | Fingerprint use | n | Min (ms) | Median | Mean | Max | StdDev | Outcome rate |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| A | 0x-hash | yes | by hash | re-hash row | 10 | 2707.02 | 6097 | 6022.47 | 8006.71 | 1678.63 | 10/10 verified |
| B | QR payload | yes | by hash | as A | 10 | 2723.02 | 6062.79 | 6038.49 | 7977.36 | 1713.07 | 10/10 = A |
| C | PDF file | yes (by ID) | by ID | both fingerprints | 10 | 515.15 | 544.2 | 551.11 | 624.44 | 32.66 | 10/10 match |

TABLE VI. VERIFICATION PERFORMANCE / NEGATIVE CASES *(T10+T12 — READY)* (unknown 5/5 @10.0–10.9 s; malformed 4/4 ≤0.23 ms; garbage 3/3 ≤0.56 ms; revoked rows; chain-only rows)

TABLE VII. IPFS PERFORMANCE BY FILE SIZE *(T14 — READY; 7 rows × (upload n/min/med/mean/max/std + retrieval same) from PART 24)*

TABLE VIII. IPFS AND PIPELINE RELIABILITY RESULTS *(T15 — READY)*
| Metric | Successes/Attempts | Rate | Source date |
|---|---|---|---|
| IPFS upload | 39/39 | 100% | 2026-10-15 |
| IPFS retrieval (1st attempt) | 36/36 | 100% | 2026-10-15 |
| IPFS byte integrity (SHA-256) | 36/36 | 100% | 2026-10-15 |
| Method A/B/C valid outcomes | 10/10 each | 100% | 2026-10-15 |
| Unknown-hash detection | 5/5 | 100% | 2026-10-15 |
| Malformed-hash rejection | 4/4 | 100% | 2026-10-15 |
| Fingerprint 3-way consistency | 23/23 | 100% | 2026-10-15 |

TABLE IX. FUNCTIONAL, NEGATIVE AND SECURITY TEST CASES *(T8+T9+T10 — READY; use PART 16 matrix, footnoting "unit outcomes recorded as passing in session logs; suite offline")*

TABLE X. THREATS AND MITIGATIONS *(T22 — READY; use PART 14)*

TABLE XI. BENCHMARK CONFIGURATION *(T21 — READY; use PART 17)*

TABLE XII. LIMITATIONS AND FUTURE WORK *(T25 — READY; use PART 20)*

**PRIORITY B — Useful (with caveats footnoted)**

TABLE XIII. FINGERPRINT CONSISTENCY EVALUATION *(T19 — 23/23 artifact + 24/24 prose)*
TABLE XIV. SUPABASE INTEGRITY / RECONCILIATION *(T18 — 14 unit tests as rows; RLS external)*
TABLE XV. WRONG-NETWORK PROTECTION *(T17 — guard semantics + prose PASS; mark "recorded observation")*
TABLE XVI. REVOCATION EVALUATION *(T16 — single live revoke, prose; mark n=1)*
TABLE XVII. CERTIFICATE DATA MODEL *(T5 — READY)*
TABLE XVIII. TAMPERING DETECTION EVALUATION *(T11 — present BOTH columns: "benchmark 2026-10-15 (2/4)" and "post-fix live check (5/5, recorded)" + explicit re-run note)*

**PRIORITY C — Optional**

TABLE XIX. SMART-CONTRACT-GAS OBSERVATIONS *(prose eval-metrics values with "recorded observation, n=16" footnote)*
TABLE XX. SECURITY AUDIT FINDINGS (Task 8 A–J + audit.md) *(internal audit only)*
TABLE XXI. SYSTEM COMPONENTS *(T3)*
TABLE XXII. EXISTING VS PROPOSED *(T24 — qualitative only, marked "design comparison, not measured")*

**NOT RECOMMENDED (insufficient evidence):**
- **Certificate Issuance Performance (T13)** — n=1 → REQUIRES NEW EXPERIMENT (re-run `bench:issuance --runs=10+`).
- **Scalability / throughput / O(n) scaling tables** — prose-only fits → REQUIRES NEW PERSISTED EXPERIMENT.
- **Any comparative/baseline table vs centralized systems** — NO VALID COMPARATIVE EXPERIMENT AVAILABLE.
- **"Accuracy" table** — accuracy never measured.
- **Statistical-significance statements** — no statistical analysis exists.

---

# PART 26 — FINAL PROJECT MASTER SUMMARY (0→100%)

1. **What CertiProof is:** a working full-stack prototype that issues academic certificates, anchors a SHA-256 metadata fingerprint to Polygon Amoy, stores the PDF on IPFS (Pinata), keeps display metadata in Supabase, and verifies/revokes with three methods. [1][2]
2. **Problem:** centralized certificates are forgeable and hard to verify cross-institutionally (motivation stats external, unverified here).
3. **Proposed solution:** fingerprint → contract anchor → IPFS document → untrusted-but-reconciled DB → A/B/C verification with honest confirmation semantics.
4. **Architecture:** browser-centric TanStack Start app; exactly one server function (IPFS upload); read-only provider verification without wallets. [1]
5. **Blockchain design:** single deployed `CertChainRegistry` on Amoy testnet (80002) at `0x0992…DF50`; linear string-keyed registry; no funds/logic beyond registration/revocation/issuer admin. [1][4]
6. **Smart contract:** 179-line Solidity ^0.8.24, 11 functions, 4 events, two-tier access (superAdmin / authorizedIssuer), irreversible revocation by superAdmin only, **no contract test suite**. [1][6]
7. **Fingerprint protocol:** `certificateId|recipientName|course|issueDate` → trim/normalize → UTF-8 → SHA-256 → `0x`+64 lowercase; backward compatible (24/24 prose); covers exactly 4 fields. [1][3]
8. **IPFS:** server-side JWT, 10 MB + MIME/extension validation, CID anchored on-chain; **app never retrieves content** (write-only); benchmark: 39/39 uploads, 36/36 retrieval + integrity. [1][2]
9. **Supabase:** single `certificates` table as untrusted display metadata; reconciliation drops unanchored/mismatched rows and applies chain status; **RLS proposal not applied (external)**. [1][8]
10. **PDF generation:** jsPDF A4 landscape, fixed title, 4 anchored fields + labels, **no PDF metadata, no QR inside PDF**. [1]
11. **PDF extraction:** raw-byte label-anchored regex (no OCR) — works on app-generated text PDFs only. [1]
12. **QR:** `https://certiproof.app/verify/<hash>` in preview/PNG; decoding routes to Method A; **no in-app scanner**. [1][6]
13. **Method A:** format gate → read-only full-registry scan → 7 checks → `verified|revoked|not_found|error`; mean 6022.47 ms (n=10). [2]
14. **Method B:** QR URL → same pipeline; 10/10 consistent with A. [2]
15. **Method C:** extract → dual fingerprint + 4 field comparisons → `match|mismatch|not_found`; mean 551.11 ms (n=10). [2]
16. **Issuance:** 7 stages, wrong-network guard first, IPFS before gas, receipt-gated Supabase insert; single live run 9328 ms. [1][2]
17. **Revocation:** superAdmin-only on-chain tx; Supabase flip only after receipt; one live revoke (prose). [1][2p]
18. **Transaction confirmation:** 3-state machine, 60 s timeout = pending, blockNumber>0 required, 29 unit tests; live pending→confirmed observed (prose). [1][3]
19. **Security:** server-only secrets, sanitized proxy, poisoning defenses, wrong-network guard — internally audited (A–J), **no external audit, no contract tests, RLS external**. [1][3][8]
20. **Testing:** 123 offline tests / 7 files / 0 skips, counted on disk; pass/fail prose-recorded ("123/0 ×2"), not re-run here; progression 20→123 across Tasks 1–10. [4]
21. **Performance:** persisted: verification (n=10/method), IPFS (n=36), issuance (n=1). Testnet, no warm-ups, no percentiles, no significance tests. [2][7]
22. **Tampering evaluation:** artifact 2/4 (date, id detected; recipient, course not) vs prose post-fix 5/5 vs prose eval-metrics 6/6 — **conflict; re-run required** (C-5). [2][2p]
23. **End-to-end evaluation:** one live issuance + revoke + 42-check suite + 24-row reconciliation, all prose-recorded on 2026-10-16. [2p]
24. **Current limitations:** O(n) scan, testnet, free RPC, gateway latency, text-only Method C, 4-field integrity envelope, no scanner/QR-in-PDF, simulated email/export, no route guards, registry counts drift. [1][9]
25. **Remaining risks:** RLS, upload abuse, RPC dependence, dependency audit, pending persistence, uncommitted tree, stale stored benchmarks (0/10 blockchain-record, 2/4 tamper). [8][9]
26. **Production readiness:** **NOT production-ready** — testnet-validated research prototype.
27. **Research contributions:** R1–R9 in PART 19 (strongest: fingerprint protocol, domain separation, chain-authoritative reconciliation, confirmation semantics, measured method comparison).
28. **Strongest IEEE claims:** protocol correctness + backward compatibility; method latencies & negative-case behavior (with n and dates); IPFS reliability/integrity rates with denominators; confirmation invariants (unit-tested); trust-model design; honest pending semantics.
29. **Unsupported claims:** all items in PART 22 (100%-anything, tamper-proof, scalable, production-ready, real-time, accuracy, significance, unqualified decentralization, unmeasured manuscript numbers).
30. **Recommended tables:** PART 25 Priority A (I–XII); B with footnotes; C optional; never T13/scalability/comparison/accuracy.
31. **Recommended figures:** F1–F7 primary (architecture, issuance sequence, confirmation state machine, fingerprint flow, Method A/C flows, A/B/C overview); F8–F15 secondary.
32. **Experiments still needed:** issuance n≥10 persisted; tamper re-run persisted post-fix; gas/throughput/scalability persisted; comparison-vs-centralized baseline; contract test suite; external dependency/security audit; (optional) multi-RPC and mainnet pilots.

---

## FINAL IEEE EVIDENCE STATUS

**Project understanding: 95%** — full tree mapped (code, tests, benchmarks, 21 session files, git state); residual gaps: live Supabase schema/RLS (external), `.env` values deliberately not read, prior 187 KB report read structurally, not line-by-line.

**Implementation evidence: 90%** — every architectural claim traced to `file:line` or count; gaps: live RLS state, some UI/runtime behaviors only provable by execution.

**Live experimental evidence: 60%** — three machine-artifact benchmark JSONs from real testnet runs (IPFS n=36, verification n=10×3, issuance n=1); **all live-script outcomes (42/42, 5/5, 24/24, revoke, wrong-network, confirmation) are prose-only**, raw outputs never persisted; no re-execution in this audit.

**Security evidence: 55%** — ~25 security-tagged offline tests, static secret scan artifact, two prose bundle scans, internal A–J audit; **missing**: contract-level authorization tests, external audit, dependency advisory scan, applied RLS, automated XSS testing.

**Performance evidence: 65%** — strong for verification & IPFS latency (testnet, small n, medians/stdDev stored); weak for issuance (n=1), gas/throughput/scalability (prose), revocation/Supabase (n≤1); **no percentiles, no warm-ups, no statistical analysis**.

**Testing evidence: 75%** — 123 tests verified on disk with exact names and 0 skips; outcomes recorded as passing in session logs but **no raw test artifact and not re-run**; zero contract tests; no CI.

**Research-paper readiness: 65%** — sufficient to draft an honest IEEE paper (architecture, protocol, methods, IPFS/verification results, limitations); blocked from stronger claims by the conflicts (tamper 2/4 vs 5/5; issuance n=1), unpersisted prose metrics, missing related-work validation, and absent comparative experiments.

### A. STRONGEST VERIFIED CLAIMS
1. The fingerprint protocol is exactly SHA-256 over a fixed 4-field canonical string, `0x`+64 lowercase hex — proven by protocol-vector unit tests and source (`certificate-fingerprint.ts`).
2. The fingerprint is byte-compatible with all existing on-chain records — 24/24 stored + 24/24 chain matches (2026-10-16, recorded observation; earlier 12/12+12/12).
3. Pending transactions are never reported as success; synthetic `blockNumber:0` receipts are rejected — 29 unit tests.
4. Method A/B/C behave correctly on live testnet data: 10/10 each; B≡A 10/10; negatives 5/5 + 4/4 + 3/3 (machine artifacts, 2026-10-15).
5. IPFS pipeline achieved 39/39 uploads, 36/36 retrievals, 36/36 byte-identical integrity (machine artifact, 2026-10-15).
6. Supabase is treated as untrusted display data with code-enforced chain reconciliation (14 unit tests for poisoning/re-keying/status override).
7. Pinata JWT and deployer key are server/off-bundle; static scan of 6 files found 0 secret findings; `.env` is git-ignored (verified).
8. Verification requires no wallet and no gas (read-only provider path in code).
9. Wrong-network signing is blocked before any transaction (guard in code + shim script PASS recorded).

### B. STRONGEST VERIFIED NUMERICAL RESULTS
- Method A: mean **6022.47 ms** (n=10; min 2707.02, median 6097, max 8006.71, stdDev 1678.63).
- Method B: mean **6038.49 ms** (n=10; min 2723.02, median 6062.79, max 7977.36, stdDev 1713.07), consistency 10/10.
- Method C: mean **551.11 ms** (n=10; min 515.15, median 544.2, max 624.44, stdDev 32.66).
- IPFS upload: mean **9508.25 ms**, median 3881.22, min 1070.15, max 54534.18, stdDev 12037.31 (n=36).
- IPFS retrieval: mean **7181.63 ms**, median 7045.28, min 4593.96, max 11009.05, stdDev 1687.95 (n=36).
- Reliability: IPFS **39/39**, **36/36**, **36/36**; verification **10/10 ×3**; unknown **5/5**; malformed **4/4**; fingerprint **23/23**.
- Issuance single run: total **9328 ms** (n=1) — *illustrative only, not a distribution*.
- Negative-case latencies: unknown hash 10015.06–10926.37 ms; malformed ≤0.23 ms; garbage ≤0.56 ms.
- Tamper (artifact): **2/4** (date 516.45 ms, id 402.05 ms detected; recipient, course not) — conflicts with recorded post-fix 5/5.

### C. ALL IEEE-READY TABLES
Priority A: T1 stack, T2 contract, T4 trust model, T6 integrity mechanisms, T7 methods comparison, T10/T12 negatives+performance, T14 IPFS by size, T15 reliability, T8/T9/T10 test matrix, T22 threats, T21 setup, T25 limitations.
Priority B (footnoted): T19 fingerprint consistency, T18 Supabase integrity, T17 wrong-network, T16 revocation, T5 data model, T11 tamper (dual-column).
Priority C: gas observations (prose), audit findings (internal), T3 components, T24 (qualitative only).

### D. ALL IEEE-READY FIGURES
F1 architecture · F2 issuance sequence · F3 confirmation state machine · F4 fingerprint flow · F5 Method A flow · F6 Method C flow · F7 A/B/C overview · F8 trust boundary · F9 Supabase reconciliation · F10 lifecycle · F11 revocation · F12 IPFS flow · F13 end-to-end sequence · F14 threat model · F15 QR workflow (annotated as external-camera).

### E. EXPERIMENTS STILL NEEDED
1. Issuance benchmark re-run n≥10 on current code, persisted.
2. Tamper-detection re-run post-Task-7, persisted (resolve 2/4 vs 5/5).
3. Re-run `bench:verification` to refresh stale 0/10 blockchain-record result.
4. Persisted gas/throughput/O(n)-scaling measurements (eval-metrics writes nothing to disk).
5. Persisted outputs for live scripts (42-check e2e, revoke, wrong-network, compat).
6. Contract test suite (Hardhat) + static analysis (Slither) + dependency advisory audit.
7. Comparative baseline (centralized lookup vs chain scan) — currently NO VALID COMPARATIVE EXPERIMENT AVAILABLE.
8. RLS application + hostile-INSERT test in a staging database.
9. Raw `bun test` output artifact for the 123-test claim.
10. Related-work reference verification (DOIs/venues) before submission.

### F. CLAIMS THAT MUST NOT BE MADE
"100% secure/reliesble/fraud-proof" · "tamper-proof" · "immutable (unqualified)" · "scalable" · "production-ready" · "zero-latency/real-time/sub-second (A/B)" · "AI-powered" · "fully decentralized/decentralized (unqualified)" · "accuracy X%" · "statistically significant" · manuscript latencies 15–30 s / 3–8 s / 5–10 s and cost 0.001–0.005 POL · "blockchain proves academic genuineness" · "QR scanning in-app" · "email delivery/batch export/settings persistence" · undated certificate counts · any single tamper-detection rate until re-run · "IPFS guarantees permanence/confidentiality".

### G. FINAL GAPS BEFORE IEEE SUBMISSION
1. Resolve C-5 (tamper conflict) with a persisted re-run; publish only that number.
2. Restore an n≥10 issuance baseline on current code (C-7) or exclude issuance latency from Results.
3. Refresh the verification benchmark so stored artifacts reflect the Task-10 `resolveRegistrationTx` fix (C-6).
4. Date-stamp and re-measure the on-chain/Supabase record counts read-only (C-3; audit C-02).
5. Replace all manuscript numbers flagged in audit C-01 with measured values (or remove them).
6. Persist raw outputs: `bun test`, live scripts, eval-metrics (currently prose-only).
7. Validate every citation/DOI (audit H-06) and complete the related-work comparison table.
8. Fix or footnote known UI mislabels (dashboard "Verified", hard-coded "Connected") and simulated features.
9. Commit the working tree (Tasks 1–10 uncommitted) for reproducible artifact citing.
10. Owner-side external actions: apply RLS (staging first), rate-limit the upload endpoint, decide Pinata JWT rotation, run dependency advisory scan.

*End of audit. All numbers above were read from the repository during a read-only inspection on 2026-10-17; no files were modified except the creation of this document and a session log in `context_md/`.*



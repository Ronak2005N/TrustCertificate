# Certiproof — Project Summary for ChatGPT

## What is this project?

**Certiproof** is a web application for issuing, managing, and verifying digitally signed academic certificates anchored on the Polygon blockchain. It is a **final year project** (prototype stage). The institution it is built for is "Hindustan Institute of Technology & Science" (HITS).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (SSR/SSG on Vite) |
| UI Library | React 19 |
| Styling | Tailwind CSS v4 + Radix UI primitives |
| Component Library | shadcn/ui (40+ pre-built components in `src/components/ui/`) |
| Routing | TanStack Router (file-based, typed routes) |
| Package Manager | Bun |
| Language | TypeScript |
| Charts | Recharts |
| Animations | Motion (Framer Motion) |
| Forms | React Hook Form + Zod validation |
| QR Codes | `qrcode` library |
| Build Target | Nitro / Cloudflare Workers (`.output/` exists) |
| Dev Server | Vite at `http://localhost:8080` |

## Blockchain Target

- **Network:** Polygon Amoy Testnet (chainId 80002)
- **Smart Contract:** `CertChainRegistry` at `0x9C41ba7fD3a1E0Cd4E2a17b6E30fD2c9A1b47E30`
- **Explorer:** `https://amoy.polygonscan.com`
- **Issuer Wallet:** `0x71E8a4C7bF29d0a4C0Ff31B8a4A9E2f7d3C4C91A`

**Note:** The smart contract does NOT actually exist on-chain yet. The entire backend is **mock/prototype** — all functions in `src/lib/certiproof.ts` simulate async API calls with `setTimeout` delays. There is no real Supabase, no real ethers.js, and no real on-chain transactions.

## Project Structure

```
Trust Certificates/
├── src/
│   ├── routes/                    # File-based routes (TanStack Router)
│   │   ├── index.tsx              # Landing page (marketing)
│   │   ├── login.tsx              # Issuer login (any credentials work)
│   │   ├── dashboard.tsx          # Dashboard layout shell
│   │   ├── dashboard.index.tsx    # Dashboard overview (metrics, charts, recent certs)
│   │   ├── dashboard.certificates.tsx  # Certificate list with search/filter/sort
│   │   ├── issue.tsx              # Single certificate issuance (3-step wizard)
│   │   ├── issue_.bulk.tsx        # Bulk CSV issuance
│   │   ├── verify.tsx             # Public verify page (hash, QR, document upload)
│   │   ├── verify_.$hash.tsx      # Verification result page (auto-loads from hash)
│   │   ├── certificate.$id.tsx    # Certificate detail page (public)
│   │   └── settings.tsx           # Organization settings (4 tabs, no persistence)
│   ├── components/
│   │   ├── ui/                    # ~40 shadcn/ui components (button, dialog, tabs, etc.)
│   │   ├── common/                # Reusable app components
│   │   │   ├── PageHeader.tsx
│   │   │   ├── MetricCard.tsx / ChartCard
│   │   │   ├── HashDisplay.tsx
│   │   │   ├── BlockchainProof.tsx
│   │   │   ├── NetworkStatus.tsx
│   │   │   ├── ProgressSteps.tsx
│   │   │   ├── VerificationTimeline.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── EmptyState.tsx / ErrorState.tsx
│   │   │   ├── QRCodeCard.tsx
│   │   │   ├── PrototypeNotice.tsx
│   │   │   └── Reveal.tsx
│   │   ├── layout/                # Layout shells
│   │   │   ├── Logo.tsx
│   │   │   ├── PublicNav.tsx
│   │   │   ├── SiteFooter.tsx
│   │   │   └── DashboardShell.tsx
│   │   ├── landing/               # Landing page sections
│   │   │   ├── Hero.tsx
│   │   │   └── Sections.tsx (8 section components)
│   │   ├── dashboard/             # Dashboard-specific
│   │   │   ├── CertificateTable.tsx
│   │   │   └── RevokeDialog.tsx
│   │   ├── verify/                # Verification-specific
│   │   │   ├── VerificationResult.tsx
│   │   │   ├── VerificationLoader.tsx
│   │   │   └── ForensicComparison.tsx
│   │   └── certificate/
│   │       └── CertificatePreview.tsx
│   ├── lib/
│   │   ├── types.ts               # TypeScript types (Certificate, VerificationResult, etc.)
│   │   ├── certiproof.ts          # Mock service layer (all business logic, ~289 lines)
│   │   ├── demo-data.ts           # Seed data (6 demo certificates, metrics, series)
│   │   ├── utils.ts               # cn() helper
│   │   ├── error-capture.ts       # Error utilities
│   │   └── error-page.ts          # Error page utilities
│   ├── hooks/
│   │   └── use-mobile.tsx
│   ├── router.tsx                 # TanStack Router setup
│   ├── routeTree.gen.ts           # Auto-generated route tree
│   ├── server.ts                  # SSR entry
│   ├── start.ts                   # Start entry
│   └── styles.css                 # Global styles (Tailwind + CSS custom properties)
├── public/                        # Static assets (robots.txt)
├── .output/                       # Build output (Nitro/Cloudflare)
├── package.json
├── vite.config.ts
├── tsconfig.json
├── components.json                # shadcn/ui config
└── eslint.config.js
```

## Features (All Prototype/Mock)

### Completed ✅

1. **Landing Page** — Full marketing page with Hero, Trust Signals, Problem Section, Three Layers explanation, How It Works, Verification Preview, Issuer Workflow, Blockchain Proof, Stats, and CTA sections. Uses Framer Motion animations.

2. **Issuer Login** — Split-screen login form. Any email/password combination works (demo mode). Redirects to `/dashboard`.

3. **Dashboard Overview** (`/dashboard`) — Metric cards (total, verified, active, revoked), area chart for issuance over time, bar chart for verification activity, network status indicator, recent certificates table with revoke action.

4. **Certificate Management** (`/dashboard/certificates`) — Full table with search, status filter (all/active/revoked/pending), sort (newest/oldest/name A-Z), revoke action via dialog.

5. **Single Certificate Issuance** (`/issue`) — 3-step wizard: Recipient details → Certificate details → Review & issue. Live certificate preview panel. Multi-stage progress animation simulating blockchain anchoring. Post-issuance summary with hash, blockchain proof, and actions.

6. **Bulk Certificate Issuance** (`/issue/bulk`) — CSV upload, row validation, sample CSV download, progress bar during batch issuance, row-by-row status display.

7. **Public Certificate View** (`/certificate/$id`) — Certificate preview, blockchain timeline, verification info, hash display, blockchain proof, actions (download, copy hash, view transaction, share link).

8. **Certificate Verification** (`/verify`) — Three methods:
   - Method A: Enter certificate hash → navigates to result page
   - Method B: QR code scan (simulated)
   - Method C: Upload certificate document → forensic comparison (simulated; filename containing "tamper" shows mismatch)

9. **Verification Result** (`/verify/$hash`) — Animated loader with 4 stages, then result view showing outcome (verified/revoked/not_found), check marks, certificate details.

10. **Organization Settings** (`/settings`) — 4 tabs: Organization, Branding, Blockchain, Notifications. All editable fields but no persistence (state is lost on refresh).

### Key UI Components Built
- 40+ shadcn/ui components installed
- Custom components: CertificatePreview, BlockchainProof, HashDisplay, NetworkStatus, ProgressSteps, VerificationTimeline, QRCodeCard, FileUpload, MetricCard/ChartCard, StatusBadge, EmptyState, ErrorState, PrototypeNotice, Reveal (scroll animation)

## What is NOT Done / Known Limitations

### Backend / Infrastructure
- **No real database** — All data lives in a JavaScript array (`store` in `certiproof.ts`). 6 demo certificates are seeded from `demo-data.ts`. No Supabase, no PostgreSQL, no MongoDB.
- **No real authentication** — Login is cosmetic. No session management, no JWT, no auth guards on dashboard routes.
- **No real blockchain integration** — No ethers.js, no smart contract deployment, no real Polygon transactions. All `transactionHash` values are deterministic fakes from `mockHash()`.
- **No smart contract written** — The Solidity contract (`CertChainRegistry`) referenced in the UI does not exist yet.
- **No PDF generation** — Certificate download is simulated with a toast notification.
- **No email sending** — Email recipient is simulated with a toast notification.
- **No QR code generation on certificates** — QRCodeCard component exists but is not wired into the certificate flow.
- **No data persistence** — Settings, newly issued certificates, and revocations are lost on page refresh (the `store` array resets to demo data).
- **No real document extraction** — The forensic comparison is triggered by filename heuristics (`/tamper|fake|edit/i`), not actual PDF/image parsing.

### Code Quality
- No tests written (no test framework installed)
- No CI/CD pipeline configured
- No environment variable management (`.env` files)
- The `.output/` directory is committed to the repo (should be gitignored)
- `node_modules/` is in the repo (should be gitignored)

### Deployment
- Build target is Nitro/Cloudflare Workers, but no `wrangler.toml` configuration is present
- No deployment scripts or hosting setup

## Project Completion Estimate

| Area | Status |
|---|---|
| UI/Frontend | **~85%** — All pages built, responsive, well-structured |
| Service Layer | **~40%** — Mock only, needs real Supabase + ethers.js integration |
| Smart Contract | **0%** — Not written or deployed |
| Auth | **0%** — No real auth system |
| Backend API | **0%** — No server routes, all logic is client-side mock |
| PDF Generation | **0%** — Not implemented |
| Email | **0%** — Not implemented |
| Testing | **0%** — No tests |
| Deployment | **10%** — Build config exists, no actual deployment |
| **Overall** | **~25-30%** complete as a working product |

## Key Files for Understanding the Architecture

- `src/lib/types.ts` — All TypeScript interfaces
- `src/lib/certiproof.ts` — The entire mock service layer (this is where real backend logic would go)
- `src/lib/demo-data.ts` — Seed data and constants (network config, org info, demo certificates)
- `src/routes/` — All page components
- `src/components/` — All UI components
- `src/styles.css` — Tailwind CSS theme (custom properties for colors, spacing)

## How to Run

```bash
bun install
bun run dev    # Starts at http://localhost:8080
```

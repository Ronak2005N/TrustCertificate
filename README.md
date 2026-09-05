# CertiProof

Blockchain-based certificate issuance and verification platform. Issue digitally signed certificates anchored on Polygon Amoy blockchain and verify authenticity in seconds with cryptographic proof.

## Features

- **Certificate Issuance** — Generate tamper-proof certificates with SHA-256 hashing
- **Blockchain Verification** — Verify certificates against Polygon Amoy records
- **IPFS Storage** — Decentralized document storage via Pinata
- **Supabase Metadata** — Certificate details with recipient info, course, and status
- **Revocation** — Revoke compromised certificates on-chain

## Development

Requires Node.js and a package manager (this repo uses [bun](https://bun.sh)).

```sh
bun install
cp .env.example .env  # Fill in your secrets
bun run dev
```

The dev server runs at `http://localhost:8080`.

## Scripts

- `bun run dev` — start the Vite dev server
- `bun run build` — production build
- `bun run preview` — preview the production build
- `bun run lint` — ESLint
- `bun run format` — Prettier

## Tech Stack

- TanStack Start (SSR on Vite)
- React 19
- Tailwind CSS v4
- TypeScript
- ethers.js
- Hardhat
- Supabase
- Pinata (IPFS)
- Polygon Amoy (Testnet)

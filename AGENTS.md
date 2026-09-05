# Certiproof

## Context Persistence (IMPORTANT — READ EVERY SESSION)

At the start of EVERY new session:
1. Read ALL `.md` files in the `context_md/` folder to understand project history, past decisions, errors, and current state.
2. Use that context to continue work seamlessly without asking the user to re-explain things.

At the end of EVERY session (or after significant changes):
1. Write a new `.md` file in `context_md/` with format: `YYYY-MM-DD_HHMMSS.md`
2. Include: date/time, what was discussed, what changes were made, what errors were found and resolved, current project state, next steps, and any important notes.
3. Do NOT ask for permission — just write it automatically after completing work.
4. Write in detail so a future session can fully understand what happened without the user's help.

## Project Overview
CertiProof — Blockchain-based certificate issuance and verification platform. Final year project at HITS.

## Key Files
- `context_md/` — Session history (read on every new session)
- `contracts/CertChainRegistry.sol` — Smart contract
- `scripts/deploy.cjs` — Deployment script
- `hardhat.config.cjs` — Hardhat config (CJS format)
- `src/lib/blockchain/` — Frontend blockchain layer (contracts.ts, metamask.ts, verify.ts)
- `src/lib/certificates.ts` — Real blockchain certificate service
- `src/lib/hooks/useWallet.tsx` — React wallet context
- `.env` — Secrets (Pinata JWT, private key, contract address)

-- ============================================================================
-- CertiProof — Supabase RLS hardening for the `certificates` table
-- ============================================================================
--
-- REQUIRES EXTERNAL CONFIGURATION.
--
-- This file is a REVIEWABLE PROPOSAL, not an applied migration. The repository
-- does not contain the live database schema or any existing RLS policies, so
-- this must be reviewed and applied externally (Supabase SQL editor or a
-- migration) by the project owner. Before applying:
--
--   1. Verify the table/column names and types below match the deployed
--      `certificates` table. They are derived from the application's actual
--      queries in src/lib/supabase.ts and src/lib/certificates.ts — not
--      invented — but the live database may differ.
--   2. Run the preflight queries in the APPENDIX and fix any violations in
--      existing data before adding constraints.
--   3. Apply to a staging project first and exercise: public verification
--      (Methods A/B/C), certificate detail pages, issuance, and revocation.
--
-- Derived from observed application behavior:
--   - SELECT: anonymous, public (verification and certificate pages read
--     with the browser anon key; public verification must keep working).
--   - INSERT: exactly one flow — saveCertificateToSupabase() after a REAL
--     mined receipt — writing the columns listed below with the formats
--     enforced here.
--   - UPDATE: exactly one flow — updateCertificateStatusInSupabase() — and it
--     only ever writes the `status` column ('active' | 'revoked'). All other
--     columns are treated as immutable identity/metadata.
--   - DELETE: never used by the application → denied.
--
-- Residual risks that RLS alone cannot remove with the current browser-side
-- architecture (documented honestly):
--   - INSERT is allowed to `anon` because issuance writes from the browser.
--     A hostile client can therefore insert FORMAT-VALID rows, including rows
--     referencing real on-chain certificate ids. The application-side
--     reconciliation in src/lib/certificates.ts (chain hash cross-check,
--     status override from chain, metadata fingerprint gating) is the
--     compensating control: unanchored or mismatched rows are dropped or
--     stripped before being presented as verified.
--   - UPDATE can flip `status` of any row by a hostile client. Compensating
--     control: verification (Methods A/C) reads status from the blockchain,
--     and dashboard sync overrides Supabase status with the on-chain status.
--   - Recommended upgrade path (out of scope for this repository change):
--     move issuance persistence and status flips behind a server-side edge
--     function using the service-role key, and restrict these policies to
--     `authenticated` issuers.
-- ============================================================================

-- 1) Enable RLS. With RLS enabled and only the policies below, any operation
--    not explicitly allowed (e.g. DELETE for anon) is denied.
alter table public.certificates enable row level security;

-- 2) Public read access (verification depends on it).
drop policy if exists "public read certificates" on public.certificates;
create policy "public read certificates"
  on public.certificates
  for select
  to anon, authenticated
  using (true);

-- 3) Constrained insert (issuance persistence, browser anon key).
--    Formats mirror the application's own generators/validators:
--      certificate_id   — CERT-YYYY-NNNNNN (issueCertificate, isHashLike-adjacent
--                         pattern used across the app and benchmarks)
--      certificate_hash — 0x + 64 lowercase hex (fingerprint is lowercased on insert)
--      transaction_hash — 0x + 64 hex (only persisted from a mined receipt)
--      issuer_wallet    — 0x + 40 hex (EIP-55 checksummed or lowercase)
--      ipfs_cid         — non-empty
--      status           — 'active' | 'revoked' (CertificateStatus)
drop policy if exists "insert certificate metadata" on public.certificates;
create policy "insert certificate metadata"
  on public.certificates
  for insert
  to anon, authenticated
  with check (
    status in ('active', 'revoked')
    and certificate_id ~ '^CERT-[0-9]{4}-[0-9]{4,6}$'
    and certificate_hash ~ '^0x[0-9a-f]{64}$'
    and transaction_hash ~ '^0x[0-9a-fA-F]{64}$'
    and issuer_wallet ~ '^0x[0-9a-fA-F]{40}$'
    and length(trim(ipfs_cid)) > 0
  );

-- 4) Status-only update (revocation flow). RLS cannot restrict WHICH columns
--    an UPDATE touches — the trigger in step 5 enforces immutability of all
--    identity/metadata columns.
drop policy if exists "update certificate status" on public.certificates;
create policy "update certificate status"
  on public.certificates
  for update
  to anon, authenticated
  using (true)
  with check (status in ('active', 'revoked'));

-- 5) Immutability of identity/metadata columns: the application only ever
--    updates `status`; anything else is rejected at the database boundary.
create or replace function public.prevent_certificate_metadata_update()
returns trigger
language plpgsql
as $$
begin
  if new.certificate_id    is distinct from old.certificate_id
     or new.certificate_hash is distinct from old.certificate_hash
     or new.transaction_hash is distinct from old.transaction_hash
     or new.issuer_wallet   is distinct from old.issuer_wallet
     or new.ipfs_cid        is distinct from old.ipfs_cid
     or new.issue_date      is distinct from old.issue_date
     or new.recipient_name  is distinct from old.recipient_name
     or new.recipient_email is distinct from old.recipient_email
     or new.course          is distinct from old.course
     or new.certificate_type is distinct from old.certificate_type then
    raise exception 'certificates: identity/metadata columns are immutable (only status may change)';
  end if;
  return new;
end;
$$;

drop trigger if exists certificates_metadata_immutable on public.certificates;
create trigger certificates_metadata_immutable
  before update on public.certificates
  for each row execute function public.prevent_certificate_metadata_update();

-- 6) No DELETE policy exists, so RLS denies it; revoke the underlying grant as
--    well (belt and braces). The application never deletes certificate rows.
revoke delete on public.certificates from anon, authenticated;

-- APPENDIX — preflight checks to run BEFORE applying steps 1–6 ---------------
--
-- a) Duplicate certificate_id rows (fetchCertificateFromSupabase() uses
--    .single() and would fail on duplicates). If any rows are returned,
--    resolve them before adding the optional unique index:
--
--   select certificate_id, count(*)
--     from public.certificates
--    group by certificate_id
--   having count(*) > 1;
--
-- b) Optional — enforce identity uniqueness once (a) is clean:
--
--   create unique index if not exists certificates_certificate_id_key
--     on public.certificates (certificate_id);
--
-- c) Rows that would violate the insert checks above (legacy/malformed data).
--    Any returned rows predate the hardening; the application already drops
--    rows that are not anchored to a matching on-chain record:
--
--   select certificate_id
--     from public.certificates
--    where status not in ('active', 'revoked')
--       or certificate_id !~ '^CERT-[0-9]{4}-[0-9]{4,6}$'
--       or certificate_hash !~ '^0x[0-9a-f]{64}$'
--       or transaction_hash !~ '^0x[0-9a-fA-F]{64}$'
--       or issuer_wallet !~ '^0x[0-9a-fA-F]{40}$'
--       or length(trim(ipfs_cid)) = 0;

import { createClient } from "@supabase/supabase-js";

const env = import.meta.env as Record<string, string | undefined>;
const supabaseUrl = env["VITE_SUPABASE_URL"] || "";
const supabaseAnonKey = env["VITE_SUPABASE_ANON_KEY"] || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SupabaseCertificate {
  id?: number;
  certificate_id: string;
  recipient_name: string;
  recipient_email: string;
  course: string;
  certificate_type: string;
  certificate_hash: string;
  transaction_hash: string;
  issuer_wallet: string;
  ipfs_cid: string;
  issue_date: string;
  status: string;
  created_at?: string;
}

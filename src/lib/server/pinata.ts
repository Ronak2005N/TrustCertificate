import "@tanstack/react-start/server-only";

import type { IPFSUploadResult, UploadFnResult } from "../ipfs";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES: Record<string, readonly string[]> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

const PINATA_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const IPFS_GATEWAY_BASE = "https://gateway.pinata.cloud/ipfs";

export class UploadValidationError extends Error {}

export function resolvePinataJwt(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const raw = env["PINATA_JWT"];
  if (typeof raw !== "string") return undefined;
  const jwt = raw.trim();
  return jwt.length > 0 ? jwt : undefined;
}

export function validateUploadForm(form: unknown): File {
  if (!(form instanceof FormData)) {
    throw new UploadValidationError("Invalid upload request.");
  }

  const entry = form.get("file");
  if (entry == null) {
    throw new UploadValidationError("No file was provided in the upload request.");
  }
  if (typeof entry === "string") {
    throw new UploadValidationError("Invalid file upload.");
  }
  if (entry.size <= 0) {
    throw new UploadValidationError("The uploaded file is empty.");
  }
  if (entry.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("File exceeds the maximum upload size of 10 MB.");
  }

  const mimeType = entry.type.toLowerCase();
  const allowedExtensions = ALLOWED_MIME_TYPES[mimeType];
  if (!allowedExtensions) {
    throw new UploadValidationError("Unsupported file type. Allowed types: PDF, PNG, JPEG.");
  }

  const name = entry.name.toLowerCase();
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex > -1) {
    const extension = name.slice(dotIndex);
    if (!allowedExtensions.includes(extension)) {
      throw new UploadValidationError(
        `File extension does not match its content type (${mimeType}).`,
      );
    }
  }

  return entry;
}

export async function pinFileToIpfs(
  jwt: string,
  file: File,
  fetchImpl: typeof fetch = fetch,
): Promise<UploadFnResult> {
  const body = new FormData();
  body.append("file", file, file.name || "certificate");
  body.append(
    "pinataMetadata",
    JSON.stringify({
      name: file.name || "certificate",
      keyvalues: { type: "certificate" },
    }),
  );

  let response: Response;
  try {
    response = await fetchImpl(PINATA_PIN_FILE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body,
    });
  } catch (error) {
    console.error(
      "IPFS upload: network error contacting Pinata:",
      error instanceof Error ? error.message : String(error),
    );
    return {
      ok: false,
      message: "IPFS upload failed due to a network error. Please try again.",
    };
  }

  if (!response.ok) {
    console.error(`IPFS upload: Pinata rejected the request (status ${response.status}).`);
    return { ok: false, message: "IPFS upload failed. Please try again later." };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error("IPFS upload: Pinata returned an unreadable response.");
    return { ok: false, message: "IPFS upload failed. Please try again later." };
  }

  const cid = (payload as { IpfsHash?: unknown } | null)?.IpfsHash;
  if (typeof cid !== "string" || cid.length === 0) {
    console.error("IPFS upload: Pinata response did not contain a CID.");
    return { ok: false, message: "IPFS upload failed. Please try again later." };
  }

  return { ok: true, cid, url: `${IPFS_GATEWAY_BASE}/${cid}` };
}

export async function uploadCertificateFile(form: FormData): Promise<UploadFnResult> {
  try {
    const file = validateUploadForm(form);

    const jwt = resolvePinataJwt();
    if (!jwt) {
      console.error("IPFS upload: PINATA_JWT is not configured on the server.");
      return {
        ok: false,
        message: "IPFS upload is not configured on the server. Please contact the administrator.",
      };
    }

    return await pinFileToIpfs(jwt, file);
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return { ok: false, message: error.message };
    }
    console.error(
      "IPFS upload: unexpected error:",
      error instanceof Error ? error.message : String(error),
    );
    return { ok: false, message: "IPFS upload failed. Please try again." };
  }
}

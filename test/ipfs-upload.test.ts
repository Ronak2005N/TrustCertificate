import { afterEach, describe, expect, test } from "bun:test";
import {
  MAX_UPLOAD_BYTES,
  UploadValidationError,
  pinFileToIpfs,
  resolvePinataJwt,
  uploadCertificateFile,
  validateUploadForm,
} from "../src/lib/server/pinata";

const ORIGINAL_JWT = process.env["PINATA_JWT"];
const REAL_FETCH = globalThis.fetch;
const FAKE_JWT = "unit-test-jwt-do-not-use";

function pdfFile(name = "CERT-2026-100001.pdf", bytes = 64): File {
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}

function formWith(entry: File | string | Blob, name?: string): FormData {
  const form = new FormData();
  if (name === undefined) form.append("file", entry);
  else form.append("file", entry, name);
  return form;
}

afterEach(() => {
  if (ORIGINAL_JWT === undefined) delete process.env["PINATA_JWT"];
  else process.env["PINATA_JWT"] = ORIGINAL_JWT;
  globalThis.fetch = REAL_FETCH;
});

describe("resolvePinataJwt", () => {
  test("returns undefined when the variable is absent", () => {
    expect(resolvePinataJwt({})).toBeUndefined();
  });

  test("returns undefined when the value is empty or whitespace", () => {
    expect(resolvePinataJwt({ PINATA_JWT: "" })).toBeUndefined();
    expect(resolvePinataJwt({ PINATA_JWT: "   " })).toBeUndefined();
  });

  test("returns the trimmed value when set", () => {
    expect(resolvePinataJwt({ PINATA_JWT: "  abc123  " })).toBe("abc123");
  });
});

describe("validateUploadForm", () => {
  test("rejects non-FormData input", () => {
    expect(() => validateUploadForm({ file: "x" })).toThrow(UploadValidationError);
    expect(() => validateUploadForm(undefined)).toThrow("Invalid upload request.");
  });

  test("rejects a form without a file entry", () => {
    expect(() => validateUploadForm(new FormData())).toThrow("No file was provided");
  });

  test("rejects a string file entry", () => {
    expect(() => validateUploadForm(formWith("not-a-file"))).toThrow("Invalid file upload.");
  });

  test("rejects an empty file", () => {
    const file = new File([], "empty.pdf", { type: "application/pdf" });
    expect(() => validateUploadForm(formWith(file))).toThrow("The uploaded file is empty.");
  });

  test("rejects an oversized file", () => {
    const file = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "big.pdf", {
      type: "application/pdf",
    });
    expect(() => validateUploadForm(formWith(file))).toThrow("maximum upload size of 10 MB");
  });

  test("rejects a disallowed MIME type", () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    expect(() => validateUploadForm(formWith(file))).toThrow("Unsupported file type");
  });

  test("rejects a missing MIME type", () => {
    const file = new File(["hello"], "notes", { type: "" });
    expect(() => validateUploadForm(formWith(file))).toThrow("Unsupported file type");
  });

  test("rejects an extension that contradicts the MIME type", () => {
    const file = new File(["png-bytes"], "cert.png", { type: "application/pdf" });
    expect(() => validateUploadForm(formWith(file))).toThrow("File extension does not match");
  });

  test("accepts a valid PDF and returns the file", () => {
    const file = pdfFile();
    expect(validateUploadForm(formWith(file))).toBeInstanceOf(File);
    expect(validateUploadForm(formWith(file)).name).toBe("CERT-2026-100001.pdf");
  });

  test("accepts PNG and JPEG certificates", () => {
    const png = new File([new Uint8Array(8)], "scan.png", { type: "image/png" });
    const jpg = new File([new Uint8Array(8)], "scan.jpeg", { type: "image/jpeg" });
    expect(validateUploadForm(formWith(png))).toBeInstanceOf(File);
    expect(validateUploadForm(formWith(jpg))).toBeInstanceOf(File);
  });

  test("accepts a valid PDF without a file extension (current behavior locked in)", () => {
    const file = new File([new Uint8Array(8)], "certificate-noext", { type: "application/pdf" });
    expect(validateUploadForm(formWith(file, "certificate-noext"))).toBeInstanceOf(File);
  });
});

describe("pinFileToIpfs", () => {
  test("uploads to Pinata with a Bearer header and returns the CID", async () => {
    let sawAuthHeader = false;
    let sawPinataMetadata = false;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const auth = headers.get("authorization") ?? "";
      sawAuthHeader = auth.startsWith("Bearer ") && auth.length > "Bearer ".length;
      const body = init?.body;
      sawPinataMetadata =
        body instanceof FormData && typeof body.get("pinataMetadata") === "string";
      return new Response(JSON.stringify({ IpfsHash: "QmUnitTestCid123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await pinFileToIpfs(FAKE_JWT, pdfFile());
    expect(result).toEqual({
      ok: true,
      cid: "QmUnitTestCid123",
      url: "https://gateway.pinata.cloud/ipfs/QmUnitTestCid123",
    });
    expect(sawAuthHeader).toBe(true);
    expect(sawPinataMetadata).toBe(true);
  });

  test("maps a Pinata HTTP failure to a safe message without response details", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "internal-pinata-detail" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const result = await pinFileToIpfs(FAKE_JWT, pdfFile());
    expect(result).toEqual({ ok: false, message: "IPFS upload failed. Please try again later." });
    expect(JSON.stringify(result)).not.toContain("internal-pinata-detail");
  });

  test("maps a non-JSON Pinata response to a safe message", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>Bad Gateway</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })) as unknown as typeof fetch;

    const result = await pinFileToIpfs(FAKE_JWT, pdfFile());
    expect(result.ok).toBe(false);
  });

  test("maps a missing IpfsHash field to a safe message", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;

    const result = await pinFileToIpfs(FAKE_JWT, pdfFile());
    expect(result.ok).toBe(false);
  });

  test("maps a network failure to a safe message", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    const result = await pinFileToIpfs(FAKE_JWT, pdfFile());
    expect(result).toEqual({
      ok: false,
      message: "IPFS upload failed due to a network error. Please try again.",
    });
  });
});

describe("uploadCertificateFile", () => {
  test("rejects without a configured credential and leaks no secret", async () => {
    delete process.env["PINATA_JWT"];
    const result = await uploadCertificateFile(formWith(pdfFile()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("not configured");
      expect(result.message).not.toContain(FAKE_JWT);
    }
  });

  test("rejects an invalid file before contacting Pinata", async () => {
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    process.env["PINATA_JWT"] = FAKE_JWT;

    const file = new File(["x"], "evil.txt", { type: "text/plain" });
    const result = await uploadCertificateFile(formWith(file));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Unsupported file type");
    expect(fetchCalled).toBe(false);
  });

  test("uploads a valid certificate end-to-end with the server credential", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ IpfsHash: "QmEndToEnd123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    process.env["PINATA_JWT"] = FAKE_JWT;

    const result = await uploadCertificateFile(formWith(pdfFile()));
    expect(result).toEqual({
      ok: true,
      cid: "QmEndToEnd123",
      url: "https://gateway.pinata.cloud/ipfs/QmEndToEnd123",
    });
  });

  test("does not leak the configured credential when Pinata rejects the request", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "invalid or expired token" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    process.env["PINATA_JWT"] = FAKE_JWT;

    const result = await uploadCertificateFile(formWith(pdfFile()));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("IPFS upload failed. Please try again later.");
      expect(result.message).not.toContain(FAKE_JWT);
      expect(result.message).not.toContain("invalid or expired token");
    }
    expect(JSON.stringify(result)).not.toContain(FAKE_JWT);
  });
});

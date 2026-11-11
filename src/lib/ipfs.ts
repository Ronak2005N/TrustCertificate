import { createServerFn } from "@tanstack/react-start";

export interface IPFSUploadResult {
  cid: string;
  url: string;
}

export type UploadFnResult =
  { ok: true; cid: string; url: string } | { ok: false; message: string };

const uploadCertificateFileFn = createServerFn({ method: "POST" })
  .validator((data: FormData): FormData => data)
  .handler(async ({ data }) => {
    const { uploadCertificateFile } = await import("./server/pinata");
    return uploadCertificateFile(data);
  });

export async function uploadToIPFS(file: File): Promise<IPFSUploadResult> {
  const form = new FormData();
  form.append("file", file, file.name);

  const result = await uploadCertificateFileFn({ data: form });
  if (!result.ok) {
    throw new Error(result.message);
  }
  return { cid: result.cid, url: result.url };
}

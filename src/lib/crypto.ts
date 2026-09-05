export async function computeSHA256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let buffer: ArrayBuffer;

  if (typeof data === "string") {
    const encoder = new TextEncoder();
    buffer = encoder.encode(data).buffer as ArrayBuffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer as ArrayBuffer;
  } else {
    buffer = data;
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeFileSHA256(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return computeSHA256(arrayBuffer);
}

export function bytes32ToHex(bytes32: string): string {
  if (bytes32.startsWith("0x")) return bytes32;
  return `0x${bytes32}`;
}

export function hexToBytes32(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return `0x${clean.padEnd(64, "0")}`;
}

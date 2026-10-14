import { toPng } from "html-to-image";

/** Minimum width (px) of an exported certificate image. */
export const CERTIFICATE_EXPORT_MIN_WIDTH = 2400;

/** Background painted behind the exported certificate so it is never transparent. */
const EXPORT_BACKGROUND = "#ffffff";

function waitForDocumentFonts(): Promise<void> {
  if (typeof document !== "undefined" && "fonts" in document) {
    return Promise.race([
      document.fonts.ready.then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 4000)),
    ]);
  }
  return Promise.resolve();
}

function waitForImages(node: HTMLElement): Promise<void> {
  const images = Array.from(node.querySelectorAll("img"));
  return Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        setTimeout(done, 3000);
      });
    }),
  ).then(() => undefined);
}

/**
 * Renders the given certificate node to a high-resolution PNG and triggers a
 * download. Captures only `node` (the certificate document itself), never the
 * surrounding page. The node is rendered at its natural (unscaled) size and
 * rasterized with a pixel ratio chosen so the output is at least
 * CERTIFICATE_EXPORT_MIN_WIDTH pixels wide while preserving the aspect ratio.
 */
export async function downloadCertificateImage(
  node: HTMLElement,
  certificateId: string,
): Promise<void> {
  await waitForDocumentFonts();
  await waitForImages(node);

  const width = node.offsetWidth || node.getBoundingClientRect().width;
  const height = node.offsetHeight || node.getBoundingClientRect().height;
  if (!width || !height) {
    throw new Error("Certificate node has no layout size");
  }

  const pixelRatio = Math.max(1, CERTIFICATE_EXPORT_MIN_WIDTH / width);

  const dataUrl = await toPng(node, {
    backgroundColor: EXPORT_BACKGROUND,
    cacheBust: true,
    pixelRatio,
    width,
    height,
    // The node lives inside a CSS-scaled wrapper on screen; the exported
    // image must always be the unscaled, layout-size rendering.
    style: { transform: "none", transformOrigin: "top left", margin: "0" },
  });

  const link = document.createElement("a");
  const safeId = (certificateId || "certificate").replace(/[^A-Za-z0-9._-]/g, "-");
  link.download = `CertiProof_${safeId}.png`;
  link.href = dataUrl;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

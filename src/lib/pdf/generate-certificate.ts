import { jsPDF } from "jspdf";

export interface CertificateData {
  id: string;
  recipientName: string;
  course: string;
  organization: string;
  issueDate: string;
  certificateNumber: string;
  qrCodeDataUrl?: string;
}

export function generateCertificatePDF(data: CertificateData): jsPDF {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  // Background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, width, height, "F");

  // Border
  doc.setDrawColor(26, 54, 93);
  doc.setLineWidth(2);
  doc.rect(10, 10, width - 20, height - 20);

  // Inner border
  doc.setDrawColor(26, 54, 93);
  doc.setLineWidth(0.5);
  doc.rect(14, 14, width - 28, height - 28);

  // Institution name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(26, 54, 93);
  doc.text(data.organization, width / 2, 40, { align: "center" });

  // Certificate title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(100, 100, 100);
  doc.text("Certificate of Completion", width / 2, 55, { align: "center" });

  // Decorative line
  doc.setDrawColor(26, 54, 93);
  doc.setLineWidth(1);
  doc.line(width / 2 - 40, 60, width / 2 + 40, 60);

  // Recipient name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("This is to certify that", width / 2, 75, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(26, 54, 93);
  doc.text(data.recipientName, width / 2, 90, { align: "center" });

  // Course
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("has successfully completed", width / 2, 102, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(data.course, width / 2, 115, { align: "center" });

  // Date and certificate number
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text(`Date: ${data.issueDate}`, width / 2 - 40, 135);
  doc.text(`Certificate No: ${data.certificateNumber}`, width / 2 - 40, 145);

  // Certificate ID
  doc.setFontSize(10);
  doc.text(`ID: ${data.id}`, width / 2 - 40, 155);

  // QR code placeholder area
  if (data.qrCodeDataUrl) {
    doc.addImage(data.qrCodeDataUrl, "PNG", width - 55, 130, 25, 25);
    doc.setFontSize(8);
    doc.text("Scan to verify", width - 42, 158);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "This certificate is blockchain-verified. Scan the QR code to verify authenticity.",
    width / 2,
    height - 20,
    { align: "center" }
  );

  return doc;
}

export async function generateCertificateBlob(
  data: CertificateData
): Promise<Blob> {
  const doc = generateCertificatePDF(data);
  return doc.output("blob");
}

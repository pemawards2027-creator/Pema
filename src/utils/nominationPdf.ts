import { jsPDF } from 'jspdf';
import type { NominationRecord } from '../types/pema';

export interface NominationPdfOptions {
  contactNumber?: string;
  contactEmail?: string;
}

export function getNominationSummaryPdfFilename(nomination: NominationRecord): string {
  const safeRef = (nomination.referenceCode || 'PEMA-NOMINATION').replace(/[^a-zA-Z0-9-_]/g, '');
  return `${safeRef}-Nomination-Summary.pdf`;
}

export function createNominationSummaryPdf(
  nomination: NominationRecord,
  options: NominationPdfOptions = {},
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 20) {
      doc.addPage();
      y = 18;
    }
  };

  // Top Royal Navy Header Banner
  doc.setFillColor(8, 24, 75); // #08184B
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(234, 179, 8); // #EAB308
  doc.rect(0, 34, pageWidth, 2, 'F');

  doc.setTextColor(234, 179, 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PHILIPPINE EXCELLENCY AND MERIT AWARDS (PEMA)', margin, 13);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.text('Official Nomination Summary', margin, 23);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(`Ref: ${nomination.referenceCode}`, pageWidth - margin, 14, { align: 'right' });
  doc.text(`Status: ${nomination.status}`, pageWidth - margin, 21, { align: 'right' });
  doc.text(
    `Submitted: ${(nomination.createdAt || '').slice(0, 10) || 'N/A'}`,
    pageWidth - margin,
    28,
    { align: 'right' },
  );

  y = 46;

  // Nominee Headline Box
  doc.setFillColor(250, 248, 244); // #FAF8F4
  doc.setDrawColor(217, 167, 38); // #D9A726
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

  doc.setTextColor(168, 28, 28); // #A81C1C
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('NOMINEE DOSSIER OVERVIEW', margin + 5, y + 6.5);

  doc.setTextColor(8, 24, 75);
  doc.setFontSize(14);
  doc.text(nomination.completeName, margin + 5, y + 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 72, 107);
  doc.text(
    `${nomination.currentWorkProfession} · Age ${nomination.currentAge}`,
    margin + 5,
    y + 19,
  );

  y += 30;

  const drawFieldRow = (label: string, value: string) => {
    const cleanValue = (value || 'Not provided').trim() || 'Not provided';
    const lines = doc.splitTextToSize(cleanValue, contentWidth - 4);
    const blockHeight = 6 + lines.length * 4.8 + 4;
    ensureSpace(blockHeight);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 112, 140);
    doc.text(label.toUpperCase(), margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(8, 24, 75);
    doc.text(lines, margin, y + 5);

    y += blockHeight;
    doc.setDrawColor(225, 229, 236);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
    y += 2;
  };

  // Section 1: Required Nominee Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(8, 24, 75);
  doc.text('I. Nominee Information', margin, y);
  y += 7;

  drawFieldRow('Complete Name', nomination.completeName);
  drawFieldRow('Phone Number', nomination.phoneNumber);
  drawFieldRow('Email Address', nomination.emailAddress);
  drawFieldRow('Current Age', String(nomination.currentAge));
  drawFieldRow('Current Work / Profession', nomination.currentWorkProfession);
  drawFieldRow('Complete Address', nomination.completeAddress);

  y += 4;
  ensureSpace(24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(8, 24, 75);
  doc.text('II. Credentials & Supporting Documentation', margin, y);
  y += 7;

  const cvStatus = nomination.cvFile
    ? `Attached: ${nomination.cvFile.fileName}`
    : nomination.cvWillFollow
      ? 'To follow once qualified'
      : 'Not attached';
  drawFieldRow('Curriculum Vitae (CV) / Personal Data Sheet (PDS)', cvStatus);

  const supportingList =
    nomination.supportingDocs.length > 0
      ? nomination.supportingDocs.map((d, i) => `${i + 1}. ${d.fileName}`).join('\n')
      : 'None attached';
  drawFieldRow('Supporting Documents / Proof of Accomplishments', supportingList);

  drawFieldRow(
    'Major Projects, Programs, Advocacy, or Initiatives',
    nomination.majorProjects || 'None provided',
  );

  if (nomination.committeeNotes) {
    drawFieldRow('Committee Evaluation Remarks', nomination.committeeNotes);
  }

  // Important Note Callout
  const noteText =
    'IMPORTANT NOTE: Nomination does not automatically guarantee an award. All nominees should undergo evaluation based on the established criteria and the supporting information provided.';
  const noteLines = doc.splitTextToSize(noteText, contentWidth - 10);
  const noteHeight = noteLines.length * 4.5 + 10;
  ensureSpace(noteHeight + 16);

  y += 3;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(168, 28, 28);
  doc.roundedRect(margin, y, contentWidth, noteHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(168, 28, 28);
  doc.text(noteLines, margin + 5, y + 6.5);

  y += noteHeight + 10;
  ensureSpace(12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 112, 140);
  const contactNum = options.contactNumber || '0924-173-7587';
  const contactEmail = options.contactEmail || 'pem.awards2027@gmail.com';
  doc.text(
    `Philippine Excellency and Merit Awards (PEMA) Secretariat · ${contactNum} · ${contactEmail}`,
    margin,
    y,
  );
  doc.text(`Generated ${new Date().toISOString().slice(0, 10)}`, pageWidth - margin, y, {
    align: 'right',
  });

  return doc;
}

export function buildNominationSummaryPdfBytes(
  nomination: NominationRecord,
  options: NominationPdfOptions = {},
): Uint8Array {
  const doc = createNominationSummaryPdf(nomination, options);
  const buffer = doc.output('arraybuffer');
  return new Uint8Array(buffer);
}

export function downloadNominationSummaryPdf(
  nomination: NominationRecord,
  options: NominationPdfOptions = {},
): string {
  const filename = getNominationSummaryPdfFilename(nomination);
  const bytes = buildNominationSummaryPdfBytes(nomination, options);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

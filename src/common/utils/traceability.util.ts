import { randomBytes } from 'crypto';

/**
 * Generate a unique batch ID for traceability
 * Format: BATCH-YYYYMMDD-HHMMSS-XXXXXX (where XXXXXX is random hex)
 */
export function generateBatchId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = randomBytes(3).toString('hex').toUpperCase();
  return `BATCH-${dateStr}-${timeStr}-${random}`;
}

/**
 * Generate a QR code string for a batch
 * This is a simple implementation - in production, you might want to use a QR code library
 * Format: QR-{batchId}
 */
export function generateQRCode(batchId: string): string {
  return `QR-${batchId}`;
}

/**
 * Generate batch ID and QR code together
 */
export function generateBatchTraceability() {
  const batchId = generateBatchId();
  const qrCode = generateQRCode(batchId);
  return { batchId, qrCode };
}

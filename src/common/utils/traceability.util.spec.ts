import { generateBatchId, generateQRCode, generateBatchTraceability } from './traceability.util';

describe('Traceability Utilities', () => {
  describe('generateBatchId()', () => {
    it('should generate unique batch IDs', () => {
      const batchId1 = generateBatchId();
      const batchId2 = generateBatchId();

      expect(batchId1).toBeDefined();
      expect(batchId2).toBeDefined();
      expect(batchId1).not.toBe(batchId2);
    });

    it('should follow format BATCH-YYYYMMDD-HHMMSS-XXXXXX', () => {
      const batchId = generateBatchId();
      const pattern = /^BATCH-\d{8}-\d{6}-[A-F0-9]{6}$/;

      expect(batchId).toMatch(pattern);
    });

    it('should generate different IDs on each call', () => {
      const batchIds = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        batchIds.add(generateBatchId());
      }

      // Due to random component, we should have unique IDs
      // Allow for some collisions due to timing (same second)
      expect(batchIds.size).toBeGreaterThan(iterations * 0.9);
    });

    it('should include date in YYYYMMDD format', () => {
      const batchId = generateBatchId();
      const dateMatch = batchId.match(/^BATCH-(\d{8})-/);

      expect(dateMatch).toBeTruthy();
      if (dateMatch) {
        const dateStr = dateMatch[1];
        expect(dateStr.length).toBe(8);
        // Should be valid date format (YYYYMMDD)
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6));
        const day = parseInt(dateStr.substring(6, 8));
        expect(year).toBeGreaterThan(2020);
        expect(month).toBeGreaterThanOrEqual(1);
        expect(month).toBeLessThanOrEqual(12);
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(31);
      }
    });

    it('should include time in HHMMSS format', () => {
      const batchId = generateBatchId();
      const timeMatch = batchId.match(/^BATCH-\d{8}-(\d{6})-/);

      expect(timeMatch).toBeTruthy();
      if (timeMatch) {
        const timeStr = timeMatch[1];
        expect(timeStr.length).toBe(6);
        // Should be valid time format (HHMMSS)
        const hour = parseInt(timeStr.substring(0, 2));
        const minute = parseInt(timeStr.substring(2, 4));
        const second = parseInt(timeStr.substring(4, 6));
        expect(hour).toBeGreaterThanOrEqual(0);
        expect(hour).toBeLessThan(24);
        expect(minute).toBeGreaterThanOrEqual(0);
        expect(minute).toBeLessThan(60);
        expect(second).toBeGreaterThanOrEqual(0);
        expect(second).toBeLessThan(60);
      }
    });

    it('should include random hex component', () => {
      const batchId = generateBatchId();
      const randomMatch = batchId.match(/-([A-F0-9]{6})$/);

      expect(randomMatch).toBeTruthy();
      if (randomMatch) {
        const randomStr = randomMatch[1];
        expect(randomStr.length).toBe(6);
        // Should be uppercase hex
        expect(randomStr).toMatch(/^[A-F0-9]{6}$/);
      }
    });
  });

  describe('generateQRCode()', () => {
    it('should generate QR code from batchId', () => {
      const batchId = 'BATCH-20250121-120000-ABC123';
      const qrCode = generateQRCode(batchId);

      expect(qrCode).toBe('QR-BATCH-20250121-120000-ABC123');
    });

    it('should follow format QR-{batchId}', () => {
      const batchId = 'BATCH-20250121-120000-ABC123';
      const qrCode = generateQRCode(batchId);

      expect(qrCode).toMatch(/^QR-BATCH-/);
      expect(qrCode).toContain(batchId);
    });

    it('should handle different batch IDs', () => {
      const batchId1 = 'BATCH-20250121-120000-ABC123';
      const batchId2 = 'BATCH-20250122-130000-DEF456';

      const qrCode1 = generateQRCode(batchId1);
      const qrCode2 = generateQRCode(batchId2);

      expect(qrCode1).toBe('QR-BATCH-20250121-120000-ABC123');
      expect(qrCode2).toBe('QR-BATCH-20250122-130000-DEF456');
    });
  });

  describe('generateBatchTraceability()', () => {
    it('should return both batchId and qrCode', () => {
      const result = generateBatchTraceability();

      expect(result).toHaveProperty('batchId');
      expect(result).toHaveProperty('qrCode');
      expect(result.batchId).toBeDefined();
      expect(result.qrCode).toBeDefined();
    });

    it('should have matching batchId in QR code', () => {
      const result = generateBatchTraceability();

      expect(result.qrCode).toBe(`QR-${result.batchId}`);
    });

    it('should generate valid batch ID format', () => {
      const result = generateBatchTraceability();
      const pattern = /^BATCH-\d{8}-\d{6}-[A-F0-9]{6}$/;

      expect(result.batchId).toMatch(pattern);
    });

    it('should generate valid QR code format', () => {
      const result = generateBatchTraceability();

      expect(result.qrCode).toMatch(/^QR-BATCH-\d{8}-\d{6}-[A-F0-9]{6}$/);
    });

    it('should generate different values on each call', () => {
      const result1 = generateBatchTraceability();
      const result2 = generateBatchTraceability();

      // Due to random component, they should be different
      // (unless generated in the exact same millisecond, which is unlikely)
      expect(result1.batchId).not.toBe(result2.batchId);
      expect(result1.qrCode).not.toBe(result2.qrCode);
    });

    it('should maintain consistency between batchId and qrCode', () => {
      const result = generateBatchTraceability();

      // QR code should always be QR-{batchId}
      expect(result.qrCode).toBe(`QR-${result.batchId}`);
    });
  });
});

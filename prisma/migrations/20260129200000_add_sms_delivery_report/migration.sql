-- CreateTable: SmsDeliveryReport for Africa's Talking DLR callback correlation
CREATE TABLE "sms_delivery_reports" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_delivery_reports_pkey" PRIMARY KEY ("id")
);

-- Advisory: add smsDeliveredCount (DLR-confirmed SMS deliveries)
ALTER TABLE "advisories" ADD COLUMN "smsDeliveredCount" INTEGER DEFAULT 0;

-- UniqueConstraint and indexes for SmsDeliveryReport
CREATE UNIQUE INDEX "sms_delivery_reports_providerMessageId_key" ON "sms_delivery_reports"("providerMessageId");
CREATE INDEX "sms_delivery_reports_notificationId_idx" ON "sms_delivery_reports"("notificationId");

-- AddForeignKey
ALTER TABLE "sms_delivery_reports" ADD CONSTRAINT "sms_delivery_reports_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

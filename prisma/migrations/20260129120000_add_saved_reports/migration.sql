-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "generatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_reports_templateId_idx" ON "saved_reports"("templateId");

-- CreateIndex
CREATE INDEX "saved_reports_createdAt_idx" ON "saved_reports"("createdAt");

-- CreateIndex
CREATE INDEX "saved_reports_generatedBy_idx" ON "saved_reports"("generatedBy");

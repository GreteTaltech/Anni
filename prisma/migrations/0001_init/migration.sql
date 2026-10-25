-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "DecisionOutcome" AS ENUM ('ACCEPTED_RECOMMENDATION', 'MANUAL_SELECTION', 'NO_SUBSTITUTE');

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "packageQuantity" DECIMAL(12,3) NOT NULL,
    "packageUnit" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "ingredients" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrl" TEXT,
    "collectedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSet" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubstitutionDecision" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "pickerName" TEXT,
    "originalProductCode" TEXT NOT NULL,
    "originalProductName" TEXT NOT NULL,
    "orderedQuantity" DECIMAL(12,3) NOT NULL,
    "outcome" "DecisionOutcome" NOT NULL,
    "selectedProductCode" TEXT,
    "selectedProductName" TEXT,
    "selectedQuantity" DECIMAL(12,3),
    "recommendationRank" INTEGER,
    "originalCost" DECIMAL(10,2) NOT NULL,
    "substituteCost" DECIMAL(10,2),
    "costDifference" DECIMAL(10,2),
    "recommendations" JSONB,
    "recommendationSource" TEXT,
    "durationMs" INTEGER,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubstitutionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_version_key" ON "Dataset"("version");

-- CreateIndex
CREATE INDEX "Product_datasetId_category_idx" ON "Product"("datasetId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Product_datasetId_code_key" ON "Product"("datasetId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSet_version_key" ON "RuleSet"("version");

-- CreateIndex
CREATE INDEX "SubstitutionDecision_createdAt_idx" ON "SubstitutionDecision"("createdAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionDecision" ADD CONSTRAINT "SubstitutionDecision_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionDecision" ADD CONSTRAINT "SubstitutionDecision_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "RuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


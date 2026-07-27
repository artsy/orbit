-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Engineer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Engineer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rotation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cadenceDays" INTEGER NOT NULL DEFAULT 7,
    "anchorDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotationMember" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "engineerId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RotationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Override" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "replacementEngineerId" TEXT NOT NULL,
    "originalEngineerId" TEXT,
    "reason" TEXT,
    "createdByEmail" TEXT NOT NULL,
    "swapGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Override_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Engineer_email_key" ON "Engineer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RotationMember_rotationId_engineerId_key" ON "RotationMember"("rotationId", "engineerId");

-- CreateIndex
CREATE UNIQUE INDEX "RotationMember_rotationId_position_key" ON "RotationMember"("rotationId", "position");

-- CreateIndex
CREATE INDEX "Override_rotationId_startDate_endDate_idx" ON "Override"("rotationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Override_swapGroupId_idx" ON "Override"("swapGroupId");

-- AddForeignKey
ALTER TABLE "RotationMember" ADD CONSTRAINT "RotationMember_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "Rotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotationMember" ADD CONSTRAINT "RotationMember_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "Engineer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Override" ADD CONSTRAINT "Override_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "Rotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Override" ADD CONSTRAINT "Override_replacementEngineerId_fkey" FOREIGN KEY ("replacementEngineerId") REFERENCES "Engineer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Override" ADD CONSTRAINT "Override_originalEngineerId_fkey" FOREIGN KEY ("originalEngineerId") REFERENCES "Engineer"("id") ON DELETE SET NULL ON UPDATE CASCADE;


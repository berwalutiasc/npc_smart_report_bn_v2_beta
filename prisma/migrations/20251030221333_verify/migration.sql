-- CreateEnum
CREATE TYPE "Reasons" AS ENUM ('EMAIL_VERIFICATION', 'RESET_PASSWORD', 'LOG_IN_VERIFICATION');

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "department" TEXT,
ADD COLUMN     "permissions" TEXT[];

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" "Reasons" NOT NULL,
    "link" TEXT,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

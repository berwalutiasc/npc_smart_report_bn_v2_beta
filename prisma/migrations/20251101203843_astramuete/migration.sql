/*
  Warnings:

  - The values [LOG_IN_VERIFICATION] on the enum `Reasons` will be removed. If these variants are still used in the database, this will fail.
  - The values [SUPERADMIN] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `admins` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `students` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `userId` on the `users` table. All the data in the column will be lost.
  - The required column `id` was added to the `users` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "ReportCategory" AS ENUM ('OVERDUE', 'ONTIME');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'PARTIAL', 'APPROVED', 'REVIEWED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');

-- AlterEnum
BEGIN;
CREATE TYPE "Reasons_new" AS ENUM ('EMAIL_VERIFICATION', 'RESET_PASSWORD', 'LOGIN_VERIFICATION');
ALTER TABLE "verifications" ALTER COLUMN "reason" TYPE "Reasons_new" USING ("reason"::text::"Reasons_new");
ALTER TYPE "Reasons" RENAME TO "Reasons_old";
ALTER TYPE "Reasons_new" RENAME TO "Reasons";
DROP TYPE "public"."Reasons_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('STUDENT', 'ADMIN', 'SUPER_ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."admins" DROP CONSTRAINT "admins_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."students" DROP CONSTRAINT "students_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."verifications" DROP CONSTRAINT "verifications_userId_fkey";

-- DropIndex
DROP INDEX "public"."verifications_userId_key";

-- AlterTable
ALTER TABLE "admins" DROP CONSTRAINT "admins_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "admins_id_seq";

-- AlterTable
ALTER TABLE "students" DROP CONSTRAINT "students_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "students_id_seq";

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "userId",
ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "verifications" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "itemEvaluated" JSONB,
    "generalComment" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "category" "ReportCategory" NOT NULL DEFAULT 'ONTIME',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_approvals" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "csStudentId" TEXT,
    "cpStudentId" TEXT,
    "approvedByCS" BOOLEAN NOT NULL DEFAULT false,
    "approvedByCP" BOOLEAN NOT NULL DEFAULT false,
    "approvedAtCS" TIMESTAMP(3),
    "approvedAtCP" TIMESTAMP(3),
    "approvalCatCS" "ReportCategory",
    "approvalCatCP" "ReportCategory",
    "commentsCS" TEXT,
    "commentsCP" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_reviews" (
    "id" TEXT NOT NULL,
    "reportApprovalId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "classes_name_key" ON "classes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "items_name_key" ON "items"("name");

-- CreateIndex
CREATE INDEX "reports_reporterId_status_idx" ON "reports"("reporterId", "status");

-- CreateIndex
CREATE INDEX "reports_classId_createdAt_idx" ON "reports"("classId", "createdAt");

-- CreateIndex
CREATE INDEX "reports_status_category_idx" ON "reports"("status", "category");

-- CreateIndex
CREATE INDEX "reports_createdAt_idx" ON "reports"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "report_approvals_reportId_key" ON "report_approvals"("reportId");

-- CreateIndex
CREATE INDEX "report_approvals_reportId_idx" ON "report_approvals"("reportId");

-- CreateIndex
CREATE INDEX "report_approvals_csStudentId_approvedByCS_idx" ON "report_approvals"("csStudentId", "approvedByCS");

-- CreateIndex
CREATE INDEX "report_approvals_cpStudentId_approvedByCP_idx" ON "report_approvals"("cpStudentId", "approvedByCP");

-- CreateIndex
CREATE INDEX "report_approvals_createdAt_idx" ON "report_approvals"("createdAt");

-- CreateIndex
CREATE INDEX "report_reviews_reportApprovalId_idx" ON "report_reviews"("reportApprovalId");

-- CreateIndex
CREATE INDEX "report_reviews_reportId_idx" ON "report_reviews"("reportId");

-- CreateIndex
CREATE INDEX "report_reviews_adminId_status_idx" ON "report_reviews"("adminId", "status");

-- CreateIndex
CREATE INDEX "report_reviews_createdAt_idx" ON "report_reviews"("createdAt");

-- CreateIndex
CREATE INDEX "students_classId_studentRole_idx" ON "students"("classId", "studentRole");

-- CreateIndex
CREATE INDEX "users_email_status_idx" ON "users"("email", "status");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- CreateIndex
CREATE INDEX "verifications_userId_reason_idx" ON "verifications"("userId", "reason");

-- CreateIndex
CREATE INDEX "verifications_createdAt_idx" ON "verifications"("createdAt");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_approvals" ADD CONSTRAINT "report_approvals_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_approvals" ADD CONSTRAINT "report_approvals_csStudentId_fkey" FOREIGN KEY ("csStudentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_approvals" ADD CONSTRAINT "report_approvals_cpStudentId_fkey" FOREIGN KEY ("cpStudentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_reviews" ADD CONSTRAINT "report_reviews_reportApprovalId_fkey" FOREIGN KEY ("reportApprovalId") REFERENCES "report_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_reviews" ADD CONSTRAINT "report_reviews_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_reviews" ADD CONSTRAINT "report_reviews_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `reportApprovalId` on the `report_reviews` table. All the data in the column will be lost.
  - You are about to drop the column `classId` on the `students` table. All the data in the column will be lost.
  - You are about to drop the `report_approvals` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."report_approvals" DROP CONSTRAINT "report_approvals_cpStudentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."report_approvals" DROP CONSTRAINT "report_approvals_csStudentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."report_approvals" DROP CONSTRAINT "report_approvals_reportId_fkey";

-- DropForeignKey
ALTER TABLE "public"."report_reviews" DROP CONSTRAINT "report_reviews_reportApprovalId_fkey";

-- DropForeignKey
ALTER TABLE "public"."students" DROP CONSTRAINT "students_classId_fkey";

-- DropIndex
DROP INDEX "public"."report_reviews_reportApprovalId_idx";

-- DropIndex
DROP INDEX "public"."students_classId_studentRole_idx";

-- AlterTable
ALTER TABLE "report_reviews" DROP COLUMN "reportApprovalId";

-- AlterTable
ALTER TABLE "students" DROP COLUMN "classId";

-- DropTable
DROP TABLE "public"."report_approvals";

-- CreateTable
CREATE TABLE "_StudentClasses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StudentClasses_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_StudentClasses_B_index" ON "_StudentClasses"("B");

-- CreateIndex
CREATE INDEX "classes_name_idx" ON "classes"("name");

-- AddForeignKey
ALTER TABLE "_StudentClasses" ADD CONSTRAINT "_StudentClasses_A_fkey" FOREIGN KEY ("A") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudentClasses" ADD CONSTRAINT "_StudentClasses_B_fkey" FOREIGN KEY ("B") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

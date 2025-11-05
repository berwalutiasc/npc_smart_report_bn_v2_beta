/*
  Warnings:

  - You are about to drop the `_StudentClasses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."_StudentClasses" DROP CONSTRAINT "_StudentClasses_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_StudentClasses" DROP CONSTRAINT "_StudentClasses_B_fkey";

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "classId" TEXT;

-- DropTable
DROP TABLE "public"."_StudentClasses";

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

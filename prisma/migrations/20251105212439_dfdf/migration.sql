/*
  Warnings:

  - You are about to drop the column `studentRole` on the `students` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "students" DROP COLUMN "studentRole";

-- DropEnum
DROP TYPE "public"."StudentRole";

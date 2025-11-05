-- DropForeignKey
ALTER TABLE "public"."report_reviews" DROP CONSTRAINT "report_reviews_adminId_fkey";

-- AlterTable
ALTER TABLE "report_reviews" ALTER COLUMN "adminId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "report_reviews" ADD CONSTRAINT "report_reviews_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

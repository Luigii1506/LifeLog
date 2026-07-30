-- AlterTable
ALTER TABLE "asset_links" ADD COLUMN     "exerciseId" TEXT;

-- CreateIndex
CREATE INDEX "asset_links_exerciseId_idx" ON "asset_links"("exerciseId");

-- AddForeignKey
ALTER TABLE "asset_links" ADD CONSTRAINT "asset_links_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

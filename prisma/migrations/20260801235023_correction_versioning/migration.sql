-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "corrected_by_id" INTEGER,
ADD COLUMN     "correction_of_id" TEXT,
ADD COLUMN     "correction_reason" TEXT,
ADD COLUMN     "superseded_at" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "evaluations_superseded_at_idx" ON "evaluations"("superseded_at");

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_correction_of_id_fkey" FOREIGN KEY ("correction_of_id") REFERENCES "evaluations"("eval_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_corrected_by_id_fkey" FOREIGN KEY ("corrected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

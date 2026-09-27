-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "coaching_sent_at" TIMESTAMP(3),
ADD COLUMN     "coaching_sent_by_id" INTEGER,
ADD COLUMN     "coaching_text" TEXT,
ADD COLUMN     "comment" TEXT;

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_coaching_sent_by_id_fkey" FOREIGN KEY ("coaching_sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "reason_aliases" (
    "id" SERIAL NOT NULL,
    "section_code" TEXT NOT NULL,
    "source_normalized" TEXT NOT NULL,
    "source_sample" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reason_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reason_aliases_section_code_source_normalized_key" ON "reason_aliases"("section_code", "source_normalized");

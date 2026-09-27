-- CreateTable
CREATE TABLE "call_types" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "call_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "call_types_config_id_label_key" ON "call_types"("config_id", "label");

-- AddForeignKey
ALTER TABLE "call_types" ADD CONSTRAINT "call_types_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "scorecard_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

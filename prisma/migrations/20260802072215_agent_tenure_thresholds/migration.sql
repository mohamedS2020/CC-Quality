-- AlterTable
ALTER TABLE "scorecard_configs" ADD COLUMN     "new_agent_tenure_days" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "trial_window_days" INTEGER NOT NULL DEFAULT 90;

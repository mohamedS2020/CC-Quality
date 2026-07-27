-- CreateEnum
CREATE TYPE "ScoringMode" AS ENUM ('SECTION_BINARY', 'GRADED_ATTRIBUTES');

-- CreateEnum
CREATE TYPE "LensBasis" AS ENUM ('PER_ERROR', 'PER_SCORESHEET', 'FAILED_SCORESHEETS');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MODERATOR', 'AGENT');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('WEEK', 'MONTH', 'QUARTER', 'ACCUMULATIVE');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'SCORING', 'REVIEW', 'LOCKED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCORE_POSTED', 'CORRECTION_POSTED');

-- CreateTable
CREATE TABLE "agents" (
    "login_id" INTEGER NOT NULL,
    "agent_name" TEXT NOT NULL,
    "tl_name" TEXT NOT NULL,
    "join_date" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("login_id")
);

-- CreateTable
CREATE TABLE "agent_aliases" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "agent_id" INTEGER NOT NULL,

    CONSTRAINT "agent_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_configs" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "rounding_decimals" INTEGER NOT NULL DEFAULT 2,
    "pareto_cutoff" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" INTEGER,

    CONSTRAINT "scorecard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "scoring_mode" "ScoringMode" NOT NULL,
    "critical" BOOLEAN NOT NULL,
    "cap_per_attribute" BOOLEAN NOT NULL DEFAULT false,
    "rank_weight" DOUBLE PRECISION NOT NULL,
    "rank_benchmark" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "section_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributes" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_reasons" (
    "id" SERIAL NOT NULL,
    "attribute_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "error_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lenses" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "basis" "LensBasis" NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "lenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmarks" (
    "id" SERIAL NOT NULL,
    "lens_id" INTEGER NOT NULL,
    "section_id" INTEGER NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "severities" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "severities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_buckets" (
    "id" SERIAL NOT NULL,
    "config_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "training_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary_entries" (
    "id" SERIAL NOT NULL,
    "error_reason_id" INTEGER NOT NULL,
    "definition" TEXT,
    "severity_id" INTEGER,
    "training_bucket_id" INTEGER,

    CONSTRAINT "dictionary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary_thresholds" (
    "id" SERIAL NOT NULL,
    "dictionary_entry_id" INTEGER NOT NULL,
    "when_expr" TEXT NOT NULL,
    "severity_id" INTEGER,
    "training_bucket_id" INTEGER,
    "order_index" INTEGER NOT NULL,

    CONSTRAINT "dictionary_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "eval_id" TEXT NOT NULL,
    "agent_login_id" INTEGER NOT NULL,
    "config_id" INTEGER NOT NULL,
    "qa_owner" TEXT NOT NULL,
    "creation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "call_date" TIMESTAMP(3) NOT NULL,
    "call_start" TIME(0),
    "call_end" TIME(0),
    "duration_seconds" INTEGER,
    "mobile_masked" TEXT,
    "call_id" TEXT,
    "queue" TEXT,
    "transaction_type" TEXT,
    "monitoring_type" TEXT,
    "call_type" TEXT,
    "coaching_date" DATE,
    "sum_of_criticals" INTEGER NOT NULL DEFAULT 0,
    "failed_scorecard" BOOLEAN NOT NULL DEFAULT false,
    "overall_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "period_id" INTEGER,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("eval_id")
);

-- CreateTable
CREATE TABLE "evaluation_lines" (
    "id" SERIAL NOT NULL,
    "evaluation_id" TEXT NOT NULL,
    "error_reason_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "agent_login_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periods" (
    "id" SERIAL NOT NULL,
    "type" "PeriodType" NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "locked_at" TIMESTAMP(3),
    "locked_by_id" INTEGER,
    "reopened_at" TIMESTAMP(3),
    "reopened_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "evaluation_id" TEXT,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_tl_name_idx" ON "agents"("tl_name");

-- CreateIndex
CREATE UNIQUE INDEX "agent_aliases_alias_key" ON "agent_aliases"("alias");

-- CreateIndex
CREATE INDEX "agent_aliases_agent_id_idx" ON "agent_aliases"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "scorecard_configs_version_key" ON "scorecard_configs"("version");

-- CreateIndex
CREATE INDEX "scorecard_configs_isActive_idx" ON "scorecard_configs"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sections_config_id_code_key" ON "sections"("config_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "categories_section_id_label_key" ON "categories"("section_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "attributes_category_id_label_key" ON "attributes"("category_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "error_reasons_attribute_id_label_key" ON "error_reasons"("attribute_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "lenses_config_id_key_key" ON "lenses"("config_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "benchmarks_lens_id_section_id_key" ON "benchmarks"("lens_id", "section_id");

-- CreateIndex
CREATE UNIQUE INDEX "severities_config_id_label_key" ON "severities"("config_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "training_buckets_config_id_label_key" ON "training_buckets"("config_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_entries_error_reason_id_key" ON "dictionary_entries"("error_reason_id");

-- CreateIndex
CREATE INDEX "dictionary_thresholds_dictionary_entry_id_idx" ON "dictionary_thresholds"("dictionary_entry_id");

-- CreateIndex
CREATE INDEX "evaluations_agent_login_id_idx" ON "evaluations"("agent_login_id");

-- CreateIndex
CREATE INDEX "evaluations_call_date_idx" ON "evaluations"("call_date");

-- CreateIndex
CREATE INDEX "evaluations_config_id_idx" ON "evaluations"("config_id");

-- CreateIndex
CREATE INDEX "evaluations_failed_scorecard_idx" ON "evaluations"("failed_scorecard");

-- CreateIndex
CREATE INDEX "evaluations_period_id_idx" ON "evaluations"("period_id");

-- CreateIndex
CREATE INDEX "evaluation_lines_error_reason_id_idx" ON "evaluation_lines"("error_reason_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_lines_evaluation_id_error_reason_id_key" ON "evaluation_lines"("evaluation_id", "error_reason_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_agent_login_id_key" ON "users"("agent_login_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "user_permissions_permission_id_idx" ON "user_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_permission_id_key" ON "user_permissions"("user_id", "permission_id");

-- CreateIndex
CREATE INDEX "periods_status_idx" ON "periods"("status");

-- CreateIndex
CREATE UNIQUE INDEX "periods_type_label_key" ON "periods"("type", "label");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "agent_aliases" ADD CONSTRAINT "agent_aliases_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("login_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_configs" ADD CONSTRAINT "scorecard_configs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "scorecard_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_reasons" ADD CONSTRAINT "error_reasons_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lenses" ADD CONSTRAINT "lenses_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "scorecard_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmarks" ADD CONSTRAINT "benchmarks_lens_id_fkey" FOREIGN KEY ("lens_id") REFERENCES "lenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmarks" ADD CONSTRAINT "benchmarks_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "severities" ADD CONSTRAINT "severities_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "scorecard_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_buckets" ADD CONSTRAINT "training_buckets_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "scorecard_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_entries" ADD CONSTRAINT "dictionary_entries_error_reason_id_fkey" FOREIGN KEY ("error_reason_id") REFERENCES "error_reasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_entries" ADD CONSTRAINT "dictionary_entries_severity_id_fkey" FOREIGN KEY ("severity_id") REFERENCES "severities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_entries" ADD CONSTRAINT "dictionary_entries_training_bucket_id_fkey" FOREIGN KEY ("training_bucket_id") REFERENCES "training_buckets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_thresholds" ADD CONSTRAINT "dictionary_thresholds_dictionary_entry_id_fkey" FOREIGN KEY ("dictionary_entry_id") REFERENCES "dictionary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_thresholds" ADD CONSTRAINT "dictionary_thresholds_severity_id_fkey" FOREIGN KEY ("severity_id") REFERENCES "severities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_thresholds" ADD CONSTRAINT "dictionary_thresholds_training_bucket_id_fkey" FOREIGN KEY ("training_bucket_id") REFERENCES "training_buckets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_agent_login_id_fkey" FOREIGN KEY ("agent_login_id") REFERENCES "agents"("login_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "scorecard_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_lines" ADD CONSTRAINT "evaluation_lines_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("eval_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_lines" ADD CONSTRAINT "evaluation_lines_error_reason_id_fkey" FOREIGN KEY ("error_reason_id") REFERENCES "error_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_agent_login_id_fkey" FOREIGN KEY ("agent_login_id") REFERENCES "agents"("login_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periods" ADD CONSTRAINT "periods_reopened_by_id_fkey" FOREIGN KEY ("reopened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("eval_id") ON DELETE CASCADE ON UPDATE CASCADE;

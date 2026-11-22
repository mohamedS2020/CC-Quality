-- Agent email: where score, correction and coaching emails are sent, even for
-- agents without a login. An AGENT user's login email is copied from it.

-- AlterTable
ALTER TABLE "agents" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "agents_email_key" ON "agents"("email");

-- Backfill: agents that already have a login account get that account's email,
-- so the two match from day one (users.email is unique, so this can't collide).
UPDATE "agents" a
SET "email" = u."email"
FROM "users" u
WHERE u."agent_login_id" = a."login_id";

-- Stable, version-independent identity for error reasons.
--
-- Publishing a config version deep-copies the rubric tree, minting fresh
-- autoincrement ids for every reason. EvaluationLine rows keep pointing at the
-- OLD version's ids, so once a new version was activated every flag failed to
-- resolve and all reports silently read 100%. `key` is minted once and carried
-- forward on every clone, so a stored flag keeps its meaning across versions.

-- 1. Add nullable so existing rows can be backfilled.
ALTER TABLE "error_reasons" ADD COLUMN "key" TEXT;

-- 2. Backfill deterministically from (section code, attribute label, reason
--    label). Every existing version holds the same rubric, so each version's
--    copy of a reason receives the SAME key — which is exactly what relinks
--    history across versions. Must match slugifyPart() in src/lib/config/keys.ts.
UPDATE "error_reasons" er
SET "key" =
      btrim(regexp_replace(lower(s."code"),    '[^a-z0-9]+', '-', 'g'), '-') || '.' ||
      btrim(regexp_replace(lower(a."label"),   '[^a-z0-9]+', '-', 'g'), '-') || '.' ||
      btrim(regexp_replace(lower(er."label"),  '[^a-z0-9]+', '-', 'g'), '-')
FROM "attributes" a
JOIN "categories" c ON c."id" = a."category_id"
JOIN "sections"   s ON s."id" = c."section_id"
WHERE a."id" = er."attribute_id";

-- 3. Nothing may be left unkeyed.
ALTER TABLE "error_reasons" ALTER COLUMN "key" SET NOT NULL;

-- 4. Keys identify a reason within its attribute (labels already are unique there).
CREATE UNIQUE INDEX "error_reasons_attribute_id_key_key" ON "error_reasons"("attribute_id", "key");

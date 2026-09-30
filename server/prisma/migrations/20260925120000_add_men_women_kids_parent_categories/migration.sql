-- Migration A of the Category restructure (additive only, reversible —
-- see HANDOFF.md / the session that approved this for the full plan).
-- Target end-state hierarchy:
--   Category (Men/Women/Kids, 3 rows)
--     -> Subcategory (today's 6 Category rows: Demo Category x3,
--        SNEAKERS, FEMALE SNEAKERS, KID SNEAKERS)
--       -> SizeRange (already correctly modeled, unchanged)
--
-- This migration does NOT touch products.category_id, categories.section,
-- or delete/rename any of the 6 existing Category rows. It only adds the 3
-- new parent rows and backfills subcategories/products.subcategory_id
-- alongside the untouched old structure, so the app can be cut over to
-- reading the new hierarchy while the old columns/rows remain as a
-- rollback path. Migration B (dropping categories.section, nulling
-- products.category_id, deciding the fate of the 6 old Category rows) is
-- a separate, later, separately-approved migration.

-- categories.section is NOT NULL today. The 3 new Men/Women/Kids rows have
-- no section of their own (they ARE the section, going forward), so the
-- column is made nullable rather than given a placeholder value -- a
-- placeholder would just be fake data to clean up later, and nullable is
-- a strict subset of Migration B's eventual DROP COLUMN anyway.
ALTER TABLE "categories" ALTER COLUMN "section" DROP NOT NULL;

-- The 3 new top-level categories. Deterministic ids (not gen_random_uuid())
-- so this file stays self-contained and readable -- they're referenced
-- directly in the backfill below with no SELECT-back-the-id step needed.
INSERT INTO "categories" ("id", "name", "created_at") VALUES
  ('category-men',   'Men',   CURRENT_TIMESTAMP),
  ('category-women', 'Women', CURRENT_TIMESTAMP),
  ('category-kids',  'Kids',  CURRENT_TIMESTAMP);

-- Backfill: each of today's 6 Category rows becomes a Subcategory row,
-- keeping the SAME id (so the products.subcategory_id backfill below is a
-- direct copy of category_id, not a lookup), parented to the new row
-- matching its own current `section` value. Per-row mapping (confirmed
-- against live data before writing this):
--   cmucx8u8o0000nfbsumwwcaln  Demo Category    (men)   -> category-men
--   cmucx8vgs0002nfbsm9rye54r  Demo Category    (women) -> category-women
--   cmucx8wv60004nfbsrockmrm5  Demo Category    (kids)  -> category-kids
--   cmufv1a1l0000nfi036xrocqf  SNEAKERS         (men)   -> category-men
--   cmufv1uhj0002nfi0es8jys81  FEMALE SNEAKERS  (women) -> category-women
--   cmufv27s40004nfi001w6bwaq  KID SNEAKERS     (kids)  -> category-kids
-- The 3 "Demo Category" rows are migrated forward same as the real ones,
-- not special-cased -- whether to clean them up (reassign their 9 demo
-- products, drop the rows) is deferred to Migration B.
INSERT INTO "subcategories" ("id", "category_id", "name", "created_by", "created_at")
SELECT
  "id",
  CASE "section"
    WHEN 'men'   THEN 'category-men'
    WHEN 'women' THEN 'category-women'
    WHEN 'kids'  THEN 'category-kids'
  END,
  "name",
  'migration:20260925120000',
  "created_at"
FROM "categories"
WHERE "id" IN (
  'cmucx8u8o0000nfbsumwwcaln',
  'cmucx8vgs0002nfbsm9rye54r',
  'cmucx8wv60004nfbsrockmrm5',
  'cmufv1a1l0000nfi036xrocqf',
  'cmufv1uhj0002nfi0es8jys81',
  'cmufv27s40004nfi001w6bwaq'
);

-- Backfill: every product currently pointing category_id at one of those 6
-- rows now also gets subcategory_id set to the same id (which is now a
-- valid Subcategory row per the insert above). category_id is left exactly
-- as it was -- nothing is nulled out in this migration.
UPDATE "products"
SET "subcategory_id" = "category_id"
WHERE "category_id" IN (
  'cmucx8u8o0000nfbsumwwcaln',
  'cmucx8vgs0002nfbsm9rye54r',
  'cmucx8wv60004nfbsrockmrm5',
  'cmufv1a1l0000nfi036xrocqf',
  'cmufv1uhj0002nfi0es8jys81',
  'cmufv27s40004nfi001w6bwaq'
);

-- Adds ONE new table, variant_images, to support multiple ordered images
-- per colour (product-card + gallery) with provenance tracking, per the
-- approved upload flow -- see product-upload-project.md §4 Step 1 and §5b.
--
-- Owner decision (2026-09-26): new table, ProductImage left untouched.
-- ProductImage stays product-scoped and keeps working exactly as it does
-- today; this migration does not read, write, or reference it.
--
-- PURELY ADDITIVE -- this migration creates one new table and nothing
-- else. It does not ALTER, DROP, or UPDATE any existing table or row.
-- No backfill: existing ProductVariant rows keep serving their card image
-- from the existing `image_url` column exactly as they do today. A
-- variant with no variant_images rows is expected and unaffected.
--
-- APPLIED 2026-09-26 via `npm run db:apply`, after explicit owner
-- approval per AGENT_RULES.md. This file is kept as the historical
-- record of that migration -- do not re-run it or any
-- `prisma migrate`/`db push` command against it.

CREATE TABLE "variant_images" (
  "id"         TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "url"        TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "provenance" TEXT NOT NULL,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "variant_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "variant_images_provenance_check" CHECK ("provenance" IN ('ai-generated', 'staff-supplied'))
);

-- One image can't claim to be the product card (sort_order 0) twice for
-- the same colour -- mirrors the "images[0] is THE card" rule in §4.
CREATE UNIQUE INDEX "variant_images_variant_id_sort_order_key" ON "variant_images"("variant_id", "sort_order");

-- Lookup index for "all images for this variant, in order" -- the read
-- pattern both the storefront gallery and the upload-form review step use.
CREATE INDEX "variant_images_variant_id_idx" ON "variant_images"("variant_id");

-- ON DELETE CASCADE: a variant_images row has no meaning once its parent
-- colour is gone -- same lifecycle dependency, and the same choice, as
-- the existing variant_sizes -> product_variants FK (see
-- 20260831154310_init/migration.sql). Deleting a variant already cascades
-- to its sizes; this keeps images consistent with that, so a deleted
-- variant never leaves orphaned image rows behind.
ALTER TABLE "variant_images" ADD CONSTRAINT "variant_images_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subcategories: a second taxonomy level under Category, mirroring the
-- Category table's exact shape and the reassign-or-unpublish delete pattern
-- (see server/src/services/categoryService.js) so subcategoryService.js can
-- reuse the same logic. Scoped to a category, not a section directly --
-- section is inherited via the parent category.
-- Explicit, non-default PK constraint name: an older, already-applied
-- migration (20260916090000_rename_subcategory_to_category) renamed a table
-- to "categories" without renaming its primary-key index, which is still
-- called "subcategories_pkey" and is attached to "categories". Postgres
-- index names are unique per schema, not per table, so letting this new
-- table's PK auto-name itself "subcategories_pkey" collides with that
-- leftover object. Named explicitly here instead; the old index on
-- "categories" is untouched.
CREATE TABLE "subcategories" (
  "id"          TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "created_by"  TEXT NOT NULL,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subcategories_new_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "subcategories"
  ADD CONSTRAINT "subcategories_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE;

-- A name only needs to be unique within its parent category, not globally.
CREATE UNIQUE INDEX "subcategories_category_id_name_key" ON "subcategories"("category_id", "name");

-- products.subcategory_id: nullable (existing products predate subcategory
-- and a product can stay uncategorized at this level, same as category_id
-- already being nullable), same reassign-or-unpublish delete story as
-- category_id.
ALTER TABLE "products" ADD COLUMN "subcategory_id" TEXT;
ALTER TABLE "products"
  ADD CONSTRAINT "products_subcategory_id_fkey"
  FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE SET NULL;

-- Size ranges: one ordered list of size labels per (category, subcategory)
-- pair, per product-upload-project.md §4 Step 4 / §8. Kept as a simple JSON
-- array of ordered labels (e.g. ["XS","S","M","L","XL"] or ["2-3Y","4-5Y"])
-- rather than a child rows-per-size table -- there's no per-size metadata to
-- store here beyond order, and the upload form's Step 4 grid is populated
-- entirely from this one array, so a join table would be pure overhead
-- (CLAUDE.md §10: don't over-engineer).
CREATE TABLE "size_ranges" (
  "id"             TEXT NOT NULL,
  "category_id"    TEXT NOT NULL,
  "subcategory_id" TEXT NOT NULL,
  "sizes"          JSONB NOT NULL,
  "created_by"     TEXT NOT NULL,
  "updated_by"     TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "size_ranges_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "size_ranges"
  ADD CONSTRAINT "size_ranges_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE;
ALTER TABLE "size_ranges"
  ADD CONSTRAINT "size_ranges_subcategory_id_fkey"
  FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE CASCADE;

-- Exactly one size range per category+subcategory combination.
CREATE UNIQUE INDEX "size_ranges_category_id_subcategory_id_key" ON "size_ranges"("category_id", "subcategory_id");

-- §10.6: DB-level floor on stock, not just an app-layer check.
ALTER TABLE "variant_sizes" ADD CONSTRAINT "variant_sizes_quantity_nonnegative" CHECK ("quantity" >= 0);
ALTER TABLE "variant_sizes" ADD CONSTRAINT "variant_sizes_reserved_nonnegative" CHECK ("reserved_quantity" >= 0);
-- reserved_quantity must never exceed quantity: updateProduct() now rejects
-- (rather than silently clamping) any admin edit that would drop quantity
-- below the size's current reservedQuantity -- see
-- server/src/services/products.js updateProduct(). With that app-layer guard
-- in place, this is now a DB-level backstop against the same gap being
-- reopened by a future code path.
ALTER TABLE "variant_sizes" ADD CONSTRAINT "variant_sizes_reserved_lte_quantity" CHECK ("reserved_quantity" <= "quantity");

-- Audit trail on every write this feature makes (product-upload-project.md
-- §10.10). products/product_variants/variant_sizes are existing tables --
-- adding created_by retroactively as nullable so historical rows (created
-- before this feature, or by seed scripts) don't break; new writes from the
-- upload form always populate it. size_ranges/subcategories are new tables
-- created by this feature so created_by is NOT NULL there from day one.
ALTER TABLE "products" ADD COLUMN "created_by" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "created_by" TEXT;
ALTER TABLE "variant_sizes" ADD COLUMN "updated_by" TEXT;
ALTER TABLE "variant_sizes" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

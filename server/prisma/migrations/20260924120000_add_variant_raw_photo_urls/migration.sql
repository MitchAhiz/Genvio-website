-- Add real front/back photo URLs to product_variants, separate from the
-- AI-generated card image (image_url). Nullable: at least raw_front_url is
-- required by the application, but that's enforced server-side (see
-- product-upload-project.md §5/§10.4), not as a DB NOT NULL, since the row
-- is written before the app has finished validating the full upload.
ALTER TABLE "product_variants" ADD COLUMN "raw_front_url" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "raw_back_url" TEXT;

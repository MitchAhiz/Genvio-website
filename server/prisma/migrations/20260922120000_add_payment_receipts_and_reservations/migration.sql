-- Manual bank-transfer payment verification: receipts, stock reservation,
-- WhatsApp flag, order tokens.
--
-- order_token is added nullable, backfilled with a real UUID per existing
-- row (Postgres 13+ ships gen_random_uuid() in core — no pgcrypto needed),
-- then locked to NOT NULL + UNIQUE. Prisma's `@default(uuid())` is a
-- client-side default only and does not reach existing rows.

-- AlterTable: customers
ALTER TABLE "customers" ADD COLUMN     "is_whatsapp" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: orders
ALTER TABLE "orders" ADD COLUMN     "order_token" TEXT;
ALTER TABLE "orders" ADD COLUMN     "reserved_until" TIMESTAMP(3);

UPDATE "orders" SET "order_token" = gen_random_uuid()::text WHERE "order_token" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "order_token" SET NOT NULL;
CREATE UNIQUE INDEX "orders_order_token_key" ON "orders"("order_token");

-- AlterTable: variant_sizes
ALTER TABLE "variant_sizes" ADD COLUMN     "reserved_quantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: payment_receipts
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "original_filename" TEXT NOT NULL,
    "stored_filename" TEXT NOT NULL,
    "file_hash" TEXT NOT NULL,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_receipts_order_id_uploaded_at_idx" ON "payment_receipts"("order_id", "uploaded_at");
CREATE INDEX "payment_receipts_file_hash_idx" ON "payment_receipts"("file_hash");

ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data backfill: existing customers.phone values are stored in local NG
-- format (0[789][01]XXXXXXXX). Convert to E.164 (+234...) so lookup/verify
-- continue to match the same customer under the new normalizePhone(),
-- which now returns E.164. Numbers not matching this shape (already E.164,
-- or malformed) are left untouched.
UPDATE "customers"
SET "phone" = '+234' || substring("phone" from 2)
WHERE "phone" ~ '^0[789][01][0-9]{8}$';

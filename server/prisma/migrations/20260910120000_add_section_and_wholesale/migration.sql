-- AlterTable: every existing product becomes a Women's product.
ALTER TABLE "products" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'women';

-- CreateIndex
CREATE INDEX "products_section_status_idx" ON "products"("section", "status");

-- CreateTable
CREATE TABLE "wholesale_images" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "category" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wholesale_images_pkey" PRIMARY KEY ("id")
);

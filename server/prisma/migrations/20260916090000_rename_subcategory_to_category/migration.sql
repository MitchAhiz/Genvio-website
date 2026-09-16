-- RenameTable
ALTER TABLE "subcategories" RENAME TO "categories";

-- RenameColumn
ALTER TABLE "products" RENAME COLUMN "subcategory_id" TO "category_id";

-- RenameForeignKey
ALTER TABLE "products" RENAME CONSTRAINT "products_subcategory_id_fkey" TO "products_category_id_fkey";

-- DropColumn (free-text category is replaced by the categories relation)
ALTER TABLE "products" DROP COLUMN "category";

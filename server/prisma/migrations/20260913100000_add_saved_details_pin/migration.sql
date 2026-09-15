-- Opt-in saved details, unlocked by a 4-digit PIN.
-- pin_hash holds a bcrypt hash and is never returned by any endpoint.
ALTER TABLE "customers" ADD COLUMN "pin_hash" TEXT;
ALTER TABLE "customers" ADD COLUMN "details_saved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN "save_opted_out" BOOLEAN NOT NULL DEFAULT false;

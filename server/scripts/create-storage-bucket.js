// One-off script: creates the private Supabase Storage bucket for payment
// receipts if it doesn't already exist. Does not touch the Postgres
// database at all — Storage is a separate Supabase product with its own
// API, keyed by SUPABASE_SERVICE_ROLE_KEY.
//
//   node scripts/create-storage-bucket.js
require('dotenv').config()
const { ensureBucketExists } = require('../src/services/storage')

ensureBucketExists()
  .then((result) => {
    console.log(
      result.created
        ? `Created bucket "${process.env.SUPABASE_RECEIPTS_BUCKET}" (private: ${result.public === false})`
        : `Bucket "${process.env.SUPABASE_RECEIPTS_BUCKET}" already exists (private: ${result.public === false})`
    )
    if (result.public !== false) {
      console.error('WARNING: bucket is PUBLIC, not private. Receipts contain bank details — this should be fixed.')
      process.exitCode = 1
    }
  })
  .catch((err) => {
    console.error('FAILED:', err.message)
    process.exitCode = 1
  })

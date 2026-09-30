import { NairaAmount } from '../../utils/currency'

// Step 4. `blocks` mirrors StockStep's shape plus the images captured for
// each colour; `stockByBlock` is the additive units-received map. A write
// failure must leave this screen intact so staff can retry without redoing
// earlier steps — the caller (UploadPage) is responsible for that by only
// clearing state on a successful submit.
export default function ReviewStep({ mode, lockedProduct, blocks, stockByBlock, submitting, submitError, onApprove, onDiscard }) {
  return (
    <div className="flex flex-col gap-4">
      {mode === 'restock' ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          Existing product — unchanged: <b className="text-slate-900">{lockedProduct.brand} {lockedProduct.name}</b>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div><span className="block text-xs uppercase text-slate-400">Brand</span><b>{lockedProduct.brand}</b></div>
          <div><span className="block text-xs uppercase text-slate-400">Product</span><b>{lockedProduct.name}</b></div>
          <div><span className="block text-xs uppercase text-slate-400">Price</span><NairaAmount value={lockedProduct.price} className="font-semibold" /></div>
        </div>
      )}

      <div className="space-y-3">
        {blocks.map((block) => {
          const stock = stockByBlock[block.key] || {}
          const lines = Object.entries(stock).filter(([, qty]) => qty > 0).map(([size, qty]) => `${size}: +${qty}`)
          return (
            <div key={block.key} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
              {block.images?.[0] ? (
                <img src={block.images[0].url} alt={block.colourName} className="h-14 w-14 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-md bg-slate-100" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{block.colourName}</div>
                <div className="text-xs text-slate-500">{lines.length ? lines.join(', ') : 'no stock entered'}</div>
                {block.images && (
                  <div className="text-xs text-slate-400">
                    {block.images.length} image{block.images.length === 1 ? '' : 's'} — first is the product card
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{submitError}</div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDiscard}
          disabled={submitting}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-40"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onApprove}
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : 'Approve & publish'}
        </button>
      </div>
    </div>
  )
}

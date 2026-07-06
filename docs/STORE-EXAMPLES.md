# Store Examples Runbook

Use this local seed when you need realistic shop data without manually building
every store state.

```bash
npm run seed:store-examples
```

The script is repeatable. It deletes and recreates only rows with the
`store-example-*` ids, creates `/shop` when that page is missing or already
seeded by this script, and adds a Shop menu item only when one is not already
present. It applies demo Store settings for tax, shipping profiles, and promo
codes, but it does not overwrite Stripe/payment secrets or provider readiness.

To keep current Store settings while recreating products/orders:

```bash
npm run seed:store-examples -- --no-settings
```

## Public Test Pages

- `/shop` - Shop block populated with example products.
- `/cart` - Browser-local cart and manual/hosted checkout path.
- `/product/store-example-fine-art-print` - Required size/finish options,
  option price deltas, and option inventory.
- `/product/store-example-framed-print-sale` - Sale price and sale badge.
- `/product/store-example-low-stock-postcard-set` - Low stock label and admin
  inventory filter coverage.
- `/product/store-example-sold-out-calendar` - Sold-out add-to-cart blocking.
- `/product/store-example-backorder-canvas` - Backorder allowed while stock is
  zero.
- `/product/store-example-digital-download` - Non-inventory digital product.
- `/product/store-example-print-bundle` - Bundle/package option and larger
  totals.

Promo codes:

- `WELCOME10` - 10% off.
- `PRINT25` - $25 off subtotals over $150.

Demo shipping/tax:

- Studio pickup.
- Standard print shipping, free over $150.
- Express insured shipping, free over $350.
- 9.5% example tax on discounted subtotal.

## Admin Store Scenarios

Open `/admin/store` after signing in.

Seeded orders cover:

- `store-example-order-pending` - Pending manual cart request, no invoice yet.
- `store-example-order-invoiced` - Issued unpaid invoice.
- `store-example-order-paid` - Paid receipt, in studio prep, packing checklist.
- `store-example-order-shipped` - Paid receipt with carrier/tracking.
- `store-example-order-refunded` - Fulfilled order with partial refund history.
- `store-example-order-expired-link` - Issued invoice with an expired hosted
  Stripe checkout session record. No real Stripe charge exists.

Use these rows to test:

- order filters and readiness states;
- inventory reservations for pending/invoiced orders;
- low-stock/sold-out/backorder product filters;
- invoice email preview;
- receipt email preview;
- refund email preview;
- fulfillment email preview;
- packing checklist persistence;
- packing slip route;
- tax CSV export with item tax codes, shipping, discounts, payments, and
  refunds.

The seed prints signed invoice and order-status URLs after it runs so public
receipt/status pages can be opened without logging in.

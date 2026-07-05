# Stripe Test-Mode Runbook

Use this when validating hosted checkout before enabling live payments. The app keeps
manual invoice checkout as the fallback; Stripe Checkout activates only when Settings ->
Payments is complete.

## 1. Configure Settings -> Payments

1. In Stripe, use test mode.
2. Copy the test publishable key and secret key into Settings -> Payments.
3. Set provider to Stripe, mode to Test, and enable hosted Stripe checkout.
4. Configure the webhook secret after starting the local listener below.

Required local webhook URL:

```bash
http://localhost:3001/api/v1/webhooks/stripe
```

Production webhook URL:

```bash
https://your-domain.example/api/v1/webhooks/stripe
```

Required events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.expired
```

## 2. Local webhook listener

Install/login to the Stripe CLI, then forward events to Docker localhost:

```bash
stripe login
stripe listen --forward-to http://localhost:3001/api/v1/webhooks/stripe
```

Copy the printed `whsec_...` value into Settings -> Payments as the Stripe webhook secret.
The payment status should switch to hosted checkout ready once all fields are present.

## 3. Cart checkout smoke

1. Add an active product to the public cart.
2. Submit checkout.
3. Expected: the browser redirects to Stripe Checkout.
4. Pay with a Stripe test card, for example `4242 4242 4242 4242`.
5. Expected after redirect: `/invoice/[token]?payment=success` shows payment confirmation.
6. Expected in Admin -> Store:
   - order status becomes `paid`
   - invoice status becomes `paid`
   - hosted Stripe status becomes `paid`
   - Stripe session/payment intent refs are visible
   - receipt email is queued/sent through the configured email provider

## 4. Issued invoice checkout smoke

1. Create or open a manual order in Admin -> Store.
2. Save/send an invoice so it becomes issued.
3. Open the invoice link.
4. Click Pay online.
5. Complete Stripe Checkout with a test card.
6. Expected: the same paid states as cart checkout.

## 5. Cancel and expired states

Cancel from Stripe Checkout:

1. Start checkout, then use Stripe's back/cancel link.
2. Expected: the invoice page returns with `?payment=cancelled` and still shows Pay online.

Expire a test session from the Stripe CLI or dashboard:

```bash
stripe checkout sessions expire cs_test_...
```

Expected:

- webhook records the event id in `stripe_webhook_event`
- invoice hosted payment status becomes `expired`
- invoice page shows the expired-link notice and offers a fresh Pay online action
- Admin -> Store can refresh the payment link, which creates a new Checkout session

## 6. Duplicate webhook safety

Stripe may retry events. The app stores each Stripe event id in `stripe_webhook_event`.
Already processed or ignored event ids return a successful duplicate response without
changing invoice/order state again. Previously failed event ids are allowed to run again.

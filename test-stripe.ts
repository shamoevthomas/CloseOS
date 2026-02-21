import Stripe from 'stripe'; const stripe = new Stripe('sk_test_123'); stripe.subscriptions.list({limit: 1}).then(subs => console.log(Object.keys(subs.data[0]))).catch(console.error);

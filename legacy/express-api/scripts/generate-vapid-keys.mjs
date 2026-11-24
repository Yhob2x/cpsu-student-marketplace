// Generate once on your own computer. Copy values into the untracked apps/api/.env.
// Do not share the VAPID private key, upload it, or commit it to Git.
import { generateVAPIDKeys } from 'web-push';
const keys = generateVAPIDKeys();
console.log('VAPID_PUBLIC_KEY="' + keys.publicKey + '"');
console.log('VAPID_PRIVATE_KEY="' + keys.privateKey + '"');
console.log('# Set VAPID_SUBJECT="mailto:<your-real-contact-email>" manually.');
console.log('Keep the same keys across restarts and deployments. Rotating them invalidates subscriptions.');

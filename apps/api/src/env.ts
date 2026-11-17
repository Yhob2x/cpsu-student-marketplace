import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  // Staging runs behind Nginx; explicit loopback binding prevents direct API exposure.
  // Default preserves existing local deployments; staging must set BIND_HOST=127.0.0.1.
  BIND_HOST: z.enum(['127.0.0.1', '0.0.0.0']).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  UPLOAD_DIR: z.string().default('./uploads'),
  // Local is retained until OAuth, private folder setup, backup and verification are complete.
  MEDIA_STORAGE: z.enum(['local', 'google_drive']).default('local'),
  GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  // Stage 5: both release gates default off. Explicit private server approval required.
  PUSH_SUBSCRIPTIONS_ENABLED: z.enum(['true', 'false']).default('false'),
  PUSH_DELIVERY_ENABLED: z.enum(['true', 'false']).default('false'),
});
const checked = schema.parse(process.env);
if (checked.NODE_ENV === 'production' &&
    (checked.BIND_HOST !== '127.0.0.1' || checked.COOKIE_SECURE !== 'true')) {
  throw new Error('Unsafe production configuration: bind to loopback and enable secure cookies');
}
export const env = checked;

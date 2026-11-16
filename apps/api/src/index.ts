import { createApp } from './app.js';
import { env } from './env.js';
createApp().listen(env.PORT, env.BIND_HOST, () => console.log(`CPSU Marketplace API on ${env.BIND_HOST}:${env.PORT}`));

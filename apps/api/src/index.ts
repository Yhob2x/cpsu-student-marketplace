import { createApp } from './app.js';
import { env } from './env.js';
createApp().listen(env.PORT, () => console.log(`CPSU Marketplace API on :${env.PORT}`));

// Test-only same-origin proxy; the normal Vite configuration and port are untouched.
import { mergeConfig } from 'vite';
import config from './vite.config';

if (process.env.CPSU_INTEGRATION_TESTS !== '1' || process.env.NODE_ENV === 'production') {
  throw new Error('Isolated browser acceptance config requires opt-in test environment');
}

export default mergeConfig(config, {
  server: {
    host: '127.0.0.1', port: 5187, strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:4011' },
  },
});
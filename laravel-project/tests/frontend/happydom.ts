import { GlobalRegistrator } from '@happy-dom/global-registrator';

// Bun's unit tests have no browser DOM by default. Install a local, synthetic DOM
// before React Testing Library imports; no server, network or persistence is used.
GlobalRegistrator.register();

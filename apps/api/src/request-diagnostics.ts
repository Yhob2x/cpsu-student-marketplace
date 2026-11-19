import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';

/** Minimal HTTP metrics source; deliberately excludes credentials, URLs, bodies and user IDs. */
export type HttpRequestRecord = {
  event: 'http_request';
  requestId: string;
  timestamp: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
};

export function requestDiagnostics(log?: (record: HttpRequestRecord) => void): RequestHandler {
  return (req, res, next) => {
    const requestId = randomUUID(); // Never trust a client-provided ID in logs.
    const start = performance.now();
    res.setHeader('X-Request-ID', requestId);
    if (log) {
      res.once('finish', () => {
        // Express route.path is a template; baseUrl is the mounted router prefix.
        // Accept only literal, lowercase router prefixes; never log a dynamic mount value.
        const prefix = req.baseUrl;
        const template = req.route?.path;
        const safePrefix = /^(?:\/api\/v1(?:\/[a-z][a-z-]*){0,4})?$/.test(prefix);
        const route = safePrefix && typeof template === 'string'
          ? `${prefix}${prefix && template === '/' ? '' : template}` : '[unmatched]';
        log({
          event: 'http_request',
          requestId,
          timestamp: new Date().toISOString(),
          method: req.method,
          route,
          status: res.statusCode,
          durationMs: Math.round((performance.now() - start) * 100) / 100,
        });
      });
    }
    next();
  };
}

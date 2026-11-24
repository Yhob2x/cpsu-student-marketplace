/**
 * Offline summarizer for CPSU's privacy-safe JSONL http_request diagnostics.
 * No network or DB access; treats non-diagnostic lines as unrelated output.
 * Use: bun performance/summarize-requests.mjs <path-to-jsonl>
 */
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

const validRoute = /^(?:\[unmatched\]|\/(?:[a-z][a-z0-9-]*|:[a-z][a-zA-Z0-9_]*)(?:\/(?:[a-z][a-z0-9-]*|:[a-z][a-zA-Z0-9_]*))*)$/;
const methods = new Set(['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']);
const isoTime = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

/** Nearest-rank p95; the observed samples (rather than a synthetic estimate). */
export function percentile(samples, pct = 95) {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * pct / 100) - 1];
}

export function createRequestSummary() {
  const byRoute = new Map();
  const perSecond = new Map();
  const allReads = [], allWrites = [], okReads = [], okWrites = [];
  let accepted = 0;
  let rejected = 0;
  let failures = 0;
  let limited = 0;
  let other4xx = 0;
  let knownResponseSizes = 0;
  let maxResponseBytes = null;
  let earliest = Infinity;
  let latest = -Infinity;

  function accept(record) {
    if (!record || record.event !== 'http_request' || !methods.has(record.method)
      || typeof record.route !== 'string' || !validRoute.test(record.route)
      || !Number.isFinite(record.durationMs) || record.durationMs < 0 || record.durationMs > 3_600_000
      || !Number.isInteger(record.status) || record.status < 100 || record.status > 599
      || typeof record.timestamp !== 'string' || !isoTime.test(record.timestamp)) {
      rejected++;
      return false;
    }
    const millis = Date.parse(record.timestamp);
    if (!Number.isFinite(millis)) { rejected++; return false; }
    accepted++;
    earliest = Math.min(earliest, millis);
    latest = Math.max(latest, millis);
    const second = Math.floor(millis / 1000);
    perSecond.set(second, (perSecond.get(second) || 0) + 1);

    const read = record.method === 'GET' || record.method === 'HEAD' || record.method === 'OPTIONS';
    (read ? allReads : allWrites).push(record.durationMs);
    if (record.status < 400) (read ? okReads : okWrites).push(record.durationMs);
    if (record.status >= 500) failures++;
    else if (record.status === 429) limited++;
    else if (record.status >= 400) other4xx++;

    // Optional Content-Length: not necessarily gzip or transferred bytes.
    const size = Number.isSafeInteger(record.responseBytes) && record.responseBytes >= 0
      ? record.responseBytes : null;
    if (size !== null) {
      knownResponseSizes++;
      maxResponseBytes = Math.max(maxResponseBytes ?? 0, size);
    }
    const key = `${record.method} ${record.route}`;
    let route = byRoute.get(key);
    if (!route) {
      route = { requests: 0, serverErrors: 0, limited: 0, timings: [], knownResponseSizes: 0, maxResponseBytes: null };
      byRoute.set(key, route);
    }
    if (size !== null) {
      route.knownResponseSizes++;
      route.maxResponseBytes = Math.max(route.maxResponseBytes ?? 0, size);
    }
    route.requests++;
    if (record.status >= 500) route.serverErrors++;
    if (record.status === 429) route.limited++;
    route.timings.push(record.durationMs);
    return true;
  }

  function acceptLine(line) {
    try { return accept(JSON.parse(line)); }
    catch { rejected++; return false; }
  }

  function result() {
    // The count and wall time are sourced from collected log records only.
    const observedSeconds = accepted === 0 ? 0 : Math.floor((latest - earliest) / 1000) + 1;
    let peakOneSecondRps = 0;
    for (const count of perSecond.values()) peakOneSecondRps = Math.max(peakOneSecondRps, count);
    const routes = [...byRoute.entries()].map(([route, stats]) => ({
      route, requests: stats.requests, p95Ms: percentile(stats.timings),
      serverErrors: stats.serverErrors, limited: stats.limited,
      knownResponseSizes: stats.knownResponseSizes, maxResponseBytes: stats.maxResponseBytes,
    })).sort((a, b) => b.requests - a.requests || a.route.localeCompare(b.route));
    return {
      source: 'observed_http_request_logs_only',
      accepted, skippedLines: rejected, observedSeconds, activeSeconds: perSecond.size,
      averageRps: observedSeconds ? Math.round(accepted / observedSeconds * 100) / 100 : null,
      peakOneSecondRps,
      serverErrors: failures,
      serverErrorRatePct: accepted ? Math.round(failures / accepted * 10000) / 100 : null,
      limited429: limited, other4xx,
      // Content-Length is an upstream header value, not the gzipped wire payload.
      knownResponseSizes, maxResponseBytes,
      readP95Ms: percentile(okReads), writeP95Ms: percentile(okWrites),
      allReadP95Ms: percentile(allReads), allWriteP95Ms: percentile(allWrites),
      successfulReadCount: okReads.length, successfulWriteCount: okWrites.length,
      routes,
    };
  }
  return { accept, acceptLine, result };
}

if (import.meta.main) {
  const filename = process.argv[2];
  if (!filename || process.argv.length !== 3) {
    console.error('Usage: bun performance/summarize-requests.mjs <isolated-staging-http-jsonl>');
    process.exitCode = 2;
  } else {
    const summary = createRequestSummary();
    try {
      const input = createInterface({ input: createReadStream(resolve(filename)), crlfDelay: Infinity });
      for await (const line of input) summary.acceptLine(line);
      const result = summary.result();
      if (result.accepted === 0) {
        console.error('No valid http_request records; no latency or capacity evidence available.');
        process.exitCode = 1;
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error(`Could not read supplied diagnostics file: ${error instanceof Error ? error.code || error.name : 'unknown_error'}`);
      process.exitCode = 1;
    }
  }
}

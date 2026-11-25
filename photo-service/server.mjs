// Private photo service. Only Laravel may call it, and photos never leave this server.
import crypto from 'node:crypto';
import http from 'node:http';
import * as tf from '@tensorflow/tfjs';
import * as nsfw from 'nsfwjs';
import sharp from 'sharp';

const PORT = Number(process.env.PHOTO_SERVICE_PORT ?? 4310);
const TOKEN = process.env.PHOTO_SERVICE_TOKEN ?? '';
const MAX_INPUT_BYTES = 3 * 1024 * 1024;
const MAX_STORED_BYTES = 3 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const MAX_QUEUED_REQUESTS = 4;
const FORMAT_BY_MIME = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
const CLASSES = ['Neutral', 'Drawing', 'Sexy', 'Porn', 'Hentai'];

if (TOKEN.length < 32) {
  console.error('PHOTO_SERVICE_TOKEN must be at least 32 characters.');
  process.exit(1);
}

class ServiceError extends Error {
  constructor(status, code, message) { super(message ?? code); this.status = status; this.code = code; }
}

const digest = value => crypto.createHash('sha256').update(value).digest();
const authorized = req => crypto.timingSafeEqual(digest(String(req.headers['x-photo-service-token'] ?? '')), digest(TOKEN));

// Decoding proves the contents. The browser-supplied type is not trusted.
async function sanitize(bytes, mime, avatar) {
  try {
    const metadata = await sharp(bytes, { failOn: 'warning', limitInputPixels: MAX_PIXELS }).metadata();
    if (metadata.format !== FORMAT_BY_MIME[mime] || !metadata.width || !metadata.height ||
        metadata.width * metadata.height > MAX_PIXELS || (metadata.pages ?? 1) > 1) {
      throw new ServiceError(400, 'invalid_image', 'Use a valid, single-frame JPEG, PNG or WebP photo up to 24 megapixels.');
    }
    // Re-encoding removes EXIF, GPS and any extra file content.
    const output = await sharp(bytes, { failOn: 'warning', limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize(avatar ? { width: 512, height: 512, fit: 'cover', position: 'centre' }
        : { width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    if (output.byteLength > MAX_STORED_BYTES) {
      throw new ServiceError(400, 'invalid_image', 'The processed image is too large. Try a smaller photo.');
    }
    return output;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(400, 'invalid_image', 'The image could not be verified. Use a valid JPEG, PNG or WebP photo.');
  }
}

// Conservative thresholds. A corrupted or incomplete result is never treated as safe.
function assess(predictions) {
  if (predictions.length !== 5 || new Set(predictions.map(p => p.className)).size !== 5 ||
      predictions.some(p => !CLASSES.includes(p.className) || !Number.isFinite(p.probability) || p.probability < 0 || p.probability > 1)) {
    return 'uncertain';
  }
  const total = predictions.reduce((sum, prediction) => sum + prediction.probability, 0);
  if (!Number.isFinite(total) || Math.abs(total - 1) > 0.02) return 'uncertain';
  const scores = Object.fromEntries(predictions.map(p => [p.className, p.probability]));
  const explicit = scores.Porn + scores.Hentai;
  if (explicit >= 0.6) return 'explicit';
  if (explicit >= 0.12 || scores.Sexy >= 0.35) return 'uncertain';
  if (scores.Neutral + scores.Drawing < 0.65) return 'uncertain';
  return 'safe';
}

let modelPromise = null;
const getModel = () => {
  modelPromise ??= (async () => {
    tf.enableProdMode();
    await tf.setBackend('cpu');
    await tf.ready();
    return nsfw.load('MobileNetV2');
  })().catch(error => { modelPromise = null; throw error; });
  return modelPromise;
};

async function classify(bytes) {
  const model = await getModel();
  const { data, info } = await sharp(bytes).resize(224, 224, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3 || info.width !== 224 || info.height !== 224) throw new Error('Invalid classifier input');
  const image = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
  try {
    return assess(await model.classify(image, 5));
  } finally {
    image.dispose();
  }
}

// Inference runs one at a time and the waiting line is bounded.
let queue = Promise.resolve();
let queued = 0;
async function screen(bytes) {
  if (queued >= MAX_QUEUED_REQUESTS) throw new ServiceError(503, 'avatar_screening_busy');
  queued++;
  try {
    const operation = queue.then(() => classify(bytes));
    queue = operation.then(() => undefined, () => undefined);
    try {
      return await operation;
    } catch {
      throw new ServiceError(503, 'avatar_screening_unavailable');
    }
  } finally {
    queued--;
  }
}

const readBody = req => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', chunk => {
    size += chunk.length;
    if (size > MAX_INPUT_BYTES) {
      reject(new ServiceError(400, 'invalid_image', 'Upload one JPEG, PNG or WebP photo up to 3 MB.'));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
    if (!authorized(req)) throw new ServiceError(401, 'unauthorized');
    if (req.method === 'POST' && url.pathname === '/sanitize') {
      const mime = url.searchParams.get('mime') ?? '';
      if (!FORMAT_BY_MIME[mime]) throw new ServiceError(400, 'invalid_image', 'Upload a JPEG, PNG or WebP photo up to 3 MB.');
      const output = await sanitize(await readBody(req), mime, url.searchParams.get('avatar') === '1');
      res.writeHead(200, { 'Content-Type': 'image/webp', 'Content-Length': output.byteLength, 'Cache-Control': 'no-store' });
      return res.end(output);
    }
    if (req.method === 'POST' && url.pathname === '/screen') {
      return json(res, 200, { verdict: await screen(await readBody(req)) });
    }
    throw new ServiceError(404, 'not_found');
  } catch (error) {
    if (res.headersSent) return res.destroy();
    const known = error instanceof ServiceError;
    if (!known) console.error('Photo service request failed.');
    return json(res, known ? error.status : 500, { error: { code: known ? error.code : 'internal_error', message: known ? error.message : undefined } });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`Photo service listening on 127.0.0.1:${PORT}`));

import * as tf from '@tensorflow/tfjs';
import * as nsfw from 'nsfwjs';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import { HttpError } from './http.js';
import { localMediaFile } from './media-storage.js';

type Prediction = { className: string; probability: number };
export type PhotoSafety = 'safe' | 'explicit' | 'uncertain';

const CLASSES = ['Neutral', 'Drawing', 'Sexy', 'Porn', 'Hentai'] as const;
// Conservative initial thresholds; false positives and false negatives remain possible.
// Sexual content is NOT inferred from the file format alone.
export function assessSellerPhoto(predictions: ReadonlyArray<Prediction>): PhotoSafety {
  if (predictions.length !== 5 ||
      new Set(predictions.map(p => p.className)).size !== 5 ||
      predictions.some(p => !CLASSES.includes(p.className as typeof CLASSES[number]) ||
        !Number.isFinite(p.probability) || p.probability < 0 || p.probability > 1)) return 'uncertain';
  // A real five-class probability distribution must total approximately one.
  // Treat corrupted/incomplete model results as uncertain, never safe.
  const total = predictions.reduce((sum, prediction) => sum + prediction.probability, 0);
  if (!Number.isFinite(total) || Math.abs(total - 1) > 0.02) return 'uncertain';
  const scores = Object.fromEntries(predictions.map(p => [p.className, p.probability]));
  const explicit = scores.Porn + scores.Hentai;
  if (explicit >= 0.6) return 'explicit';
  if (explicit >= 0.12 || scores.Sexy >= 0.35) return 'uncertain';
  if (scores.Neutral + scores.Drawing < 0.65) return 'uncertain';
  return 'safe';
}

type Model = Awaited<ReturnType<typeof nsfw.load>>;
let modelPromise: Promise<Model> | null = null;
let classificationQueue = Promise.resolve();
let queuedRequests = 0;
const MAX_QUEUED_REQUESTS = 4;

async function getModel(): Promise<Model> {
  if (!modelPromise) modelPromise = (async () => {
    tf.enableProdMode();
    await tf.setBackend('cpu');
    await tf.ready();
    // Bundled by the pinned nsfwjs package: no external model API or
    // third-party image transmission at inference time.
    return nsfw.load('MobileNetV2');
  })().catch(error => {
    // Recover from temporary initialization failure on a subsequent upload.
    modelPromise = null;
    throw error;
  });
  return modelPromise;
}

async function classifySavedPhoto(localFile: string): Promise<PhotoSafety> {
  const model = await getModel();
  // Read into memory first so Sharp does not hold an open Windows file handle.
  // The sanitized image is already capped at 3 MB by upload-security.ts.
  const bytes = await fs.readFile(localFile);
  const { data, info } = await sharp(bytes)
    .resize(224, 224, { fit: 'fill' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 3 || info.width !== 224 || info.height !== 224)
    throw new Error('Invalid classifier input');
  const image = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
  try {
    return assessSellerPhoto(await model.classify(image, 5));
  } finally {
    image.dispose();
  }
}

// Bound concurrent CPU inference to one at a time. Do not run classification
// on the client or upload any private image to an outside moderation service.
export async function screenSellerAvatar(mediaPath: string): Promise<void> {
  const file = localMediaFile(mediaPath);
  try {
    await fs.access(file);
  } catch {
    throw new HttpError(503, 'avatar_screening_unavailable',
      'Photo safety screening is unavailable. Your current picture is unchanged.');
  }
  if (queuedRequests >= MAX_QUEUED_REQUESTS) {
    throw new HttpError(503, 'avatar_screening_busy',
      'Photo screening is busy. Your current picture is unchanged; please try again later.');
  }
  queuedRequests++;
  try {
    const operation = classificationQueue.then(() => classifySavedPhoto(file));
    classificationQueue = operation.then(() => undefined, () => undefined);
    let verdict: PhotoSafety;
    try {
      verdict = await operation;
    } catch {
      // A failed or unavailable model NEVER authorizes public publication.
      throw new HttpError(503, 'avatar_screening_unavailable',
        'Photo safety screening is temporarily unavailable. Your current picture is unchanged; please try again later.');
    }
    if (verdict === 'explicit') {
      throw new HttpError(422, 'avatar_explicit_content',
        'This picture appears to contain explicit content and cannot be used as a store profile picture.');
    }
    if (verdict === 'uncertain') {
      // No reviewer queue exists for seller avatars: fail closed, and ask for
      // another picture instead of retaining unreviewed content.
      throw new HttpError(422, 'avatar_uncertain_content',
        'We could not confirm that this picture meets the profile-photo rules. Choose another picture.');
    }
  } finally {
    queuedRequests--;
  }
}

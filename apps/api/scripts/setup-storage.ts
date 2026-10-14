/**
 * Prépare le bucket des pièces jointes : création s'il n'existe pas, puis CORS limité au front
 * (le navigateur y envoie les fichiers directement). Idempotent : relancé à chaque
 * `docker compose up` par le service `s3-setup`. En production, ces réglages se font une fois
 * chez l'hébergeur du stockage.
 */
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { validateEnv } from '../src/config/env.js';
import { createS3Client } from '../src/storage/storage.service.js';

const env = validateEnv(process.env);
const s3 = createS3Client(env, env.S3_ENDPOINT);
const Bucket = env.S3_BUCKET;

const bucketExists = await s3.send(new HeadBucketCommand({ Bucket })).then(
  () => true,
  () => false,
);
if (!bucketExists) {
  await s3.send(new CreateBucketCommand({ Bucket }));
}

await s3.send(
  new PutBucketCorsCommand({
    Bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: [env.WEB_URL],
          // POST : envoi par formulaire présigné ; GET : lecture par URL présignée
          AllowedMethods: ['GET', 'POST'],
          AllowedHeaders: ['*'],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);

console.log(`Bucket "${Bucket}" prêt (CORS : ${env.WEB_URL})`);

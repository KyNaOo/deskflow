import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { contentDisposition } from './storage-keys.js';

/** Durée de validité des URL présignées : juste le temps d'envoyer ou d'ouvrir le fichier. */
const PRESIGNED_URL_TTL_SECONDS = 5 * 60;

/** Limite de l'API S3 : DeleteObjects accepte au plus 1 000 clés par appel. */
export const MAX_KEYS_PER_DELETE = 1_000;

export type S3Settings = Pick<Env, 'S3_REGION' | 'S3_ACCESS_KEY' | 'S3_SECRET_KEY'>;

/** Client S3 (aussi utilisé par le script de préparation du bucket, hors de Nest). */
export function createS3Client(settings: S3Settings, endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: settings.S3_REGION,
    credentials: { accessKeyId: settings.S3_ACCESS_KEY, secretAccessKey: settings.S3_SECRET_KEY },
    // URL en `endpoint/bucket/clé` : SeaweedFS ne gère pas les sous-domaines par bucket
    forcePathStyle: true,
  });
}

/**
 * Stockage des pièces jointes. Les fichiers ne transitent jamais par l'API : elle signe des URL
 * et le navigateur parle directement au stockage. Les clés S3 ne quittent jamais l'API.
 */
@Injectable()
export class StorageService {
  private readonly bucket: string;
  /** Requêtes de l'API elle-même, par le réseau interne (http://s3:8333 en local) */
  private readonly s3: S3Client;
  /** Signature des URL données au navigateur : l'adresse signée doit être celle qu'il utilise */
  private readonly publicS3: S3Client;

  constructor(config: ConfigService<Env, true>) {
    const settings: S3Settings = {
      S3_REGION: config.get('S3_REGION', { infer: true }),
      S3_ACCESS_KEY: config.get('S3_ACCESS_KEY', { infer: true }),
      S3_SECRET_KEY: config.get('S3_SECRET_KEY', { infer: true }),
    };
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.s3 = createS3Client(settings, config.get('S3_ENDPOINT', { infer: true }));
    this.publicS3 = createS3Client(settings, config.get('S3_PUBLIC_URL', { infer: true }));
  }

  /**
   * Formulaire d'envoi présigné (POST). Taille et type sont des conditions de la signature :
   * le stockage refuse tout fichier qui ne correspond pas à ce qui a été validé par l'API.
   */
  createUpload(key: string, mimeType: string, size: number) {
    return createPresignedPost(this.publicS3, {
      Bucket: this.bucket,
      Key: key,
      // Chaque champ de Fields est signé comme condition d'égalité : un autre type est refusé
      Fields: { 'Content-Type': mimeType },
      // Taille exacte déclarée à l'API : un fichier plus gros (ou plus petit) est refusé
      Conditions: [['content-length-range', size, size]],
      Expires: PRESIGNED_URL_TTL_SECONDS,
    });
  }

  /** Le navigateur a-t-il réellement envoyé le fichier ? */
  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (error instanceof NotFound) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Supprime des objets en un appel (MAX_KEYS_PER_DELETE au plus). Une clé déjà absente n'est
   * pas une erreur (comportement de S3) : une suppression peut être rejouée sans risque.
   */
  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    const { Errors = [] } = await this.s3.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        // Quiet : la réponse ne liste que les échecs
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    if (Errors.length > 0) {
      const [first] = Errors;
      throw new Error(`${Errors.length} objet(s) non supprimé(s), ex. ${first!.Key} : ${first!.Code}`);
    }
  }

  /** URL de lecture temporaire, à n'émettre qu'après le contrôle d'accès. */
  downloadUrl(key: string, fileName: string, mimeType: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: mimeType,
      ResponseContentDisposition: contentDisposition(fileName, mimeType),
    });
    return getSignedUrl(this.publicS3, command, { expiresIn: PRESIGNED_URL_TTL_SECONDS });
  }
}

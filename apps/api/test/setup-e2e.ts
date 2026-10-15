import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';

// Exécuté avant chaque fichier de test, avant le chargement de la config de l'app : chaque
// suite a ses propres files Redis, que ni le worker de dev ni les autres suites ne consomment
const queuePrefix = `test-${randomUUID().slice(0, 8)}`;
process.env.QUEUE_PREFIX = queuePrefix;

afterAll(async () => {
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  for await (const keys of redis.scanIterator({ MATCH: `${queuePrefix}:*`, COUNT: 100 })) {
    if (keys.length > 0) {
      await redis.del(keys);
    }
  }
  await redis.close();
});

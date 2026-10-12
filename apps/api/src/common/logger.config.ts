import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import type { Env } from '../config/env.js';

/** Logs JSON (une ligne par requête), lisibles en développement, muets pendant les tests. */
export function loggerConfig(nodeEnv: Env['NODE_ENV']): Params {
  return {
    pinoHttp: {
      level: nodeEnv === 'test' ? 'silent' : 'info',
      transport:
        nodeEnv === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true, ignore: 'pid,hostname' } }
          : undefined,
      genReqId: (_req, res) => {
        const requestId = randomUUID();
        res.setHeader('X-Request-Id', requestId);
        return requestId;
      },
      // Le healthcheck Docker appelle /health toutes les 10 s : inutile de le journaliser
      autoLogging: { ignore: (req) => req.url === '/health' },
      // Les jetons de session ne doivent jamais apparaître dans les logs
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
    },
  };
}

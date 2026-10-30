import { createTicketSchema } from '@deskflow/shared';
import { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './helpers/create-test-app.js';

describe('Documentation OpenAPI (e2e)', () => {
  let app: INestApplication<App>;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createTestApp();
    const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
    document = response.body as OpenAPIObject;
  });

  afterAll(async () => {
    await app.close();
  });

  function operation(path: string, method: 'get' | 'post' | 'patch') {
    const found = document.paths[path]?.[method];
    if (!found) {
      throw new Error(`Route absente de la documentation : ${method.toUpperCase()} ${path}`);
    }
    return found;
  }

  it('sert l’interface sur /docs', async () => {
    const response = await request(app.getHttpServer()).get('/docs').expect(200);

    expect(response.headers['content-type']).toContain('text/html');
  });

  it('/docs-json est un document OpenAPI 3 qui liste les routes principales', () => {
    expect(document.openapi).toMatch(/^3\./);
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/auth/login',
        '/tickets',
        '/tickets/{number}',
        '/tickets/{number}/messages',
        '/tickets/{number}/attachments',
        '/users/invite',
        '/analytics/overview',
      ]),
    );
    expect(operation('/tickets', 'get').tags).toEqual(['Tickets']);
  });

  it('décrit les body et query à partir des schémas zod partagés', () => {
    const body = operation('/tickets', 'post').requestBody;
    const schema = body && 'content' in body ? body.content['application/json']?.schema : undefined;

    // Même règle que createTicketSchema : sujet de 200 caractères au plus
    expect(schema).toMatchObject({
      required: ['subject', 'message'],
      properties: { subject: { type: 'string', minLength: 1, maxLength: 200 } },
    });
    // Rien n'est réécrit : le schéma documenté est celui que zod génère
    expect(schema).toEqual(createTicketSchema['~standard'].jsonSchema.input({ target: 'openapi-3.0' }));

    expect(operation('/tickets', 'get').parameters).toContainEqual(
      expect.objectContaining({
        name: 'status',
        in: 'query',
        required: false,
        schema: { type: 'string', enum: ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] },
      }),
    );
  });

  it('indique l’authentification par cookie et les erreurs de chaque route', () => {
    expect(document.components?.securitySchemes?.cookie).toEqual({
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
    });

    const login = operation('/auth/login', 'post');
    expect(login.security).toEqual([{}]);
    expect(Object.keys(login.responses)).toEqual(expect.arrayContaining(['200', '400', '429']));
    expect(login.responses).not.toHaveProperty('401');

    const update = operation('/tickets/{number}', 'patch');
    expect(update.security).toBeUndefined(); // exigence globale : cookie access_token
    expect(Object.keys(update.responses)).toEqual(
      expect.arrayContaining(['200', '400', '401', '403', '404', '409']),
    );
    expect(update.responses[409]).toMatchObject({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
    });
  });
});

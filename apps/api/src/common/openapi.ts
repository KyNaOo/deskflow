import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ACCESS_TOKEN_COOKIE } from '../auth/auth.constants.js';

/** Interface sur `/docs`, spécification brute sur `/docs-json`. */
export const DOCS_PATH = 'docs';

const ERROR_SCHEMA = 'ErrorBody';

/**
 * Documentation OpenAPI générée depuis le code : routes et tags viennent des contrôleurs, les
 * body et query des schémas zod partagés (`@Body({ schema })`). Rien n'est réécrit à la main :
 * modifier un schéma de @deskflow/shared modifie la documentation.
 */
export function setupOpenApi(app: INestApplication, { readOnly }: { readOnly: boolean }) {
  const config = new DocumentBuilder()
    .setTitle('Deskflow API')
    .setDescription(
      'Help desk multi-tenant. La session tient dans des cookies httpOnly posés par ' +
        '`POST /auth/login` : une fois connecté avec « Try it out », les autres routes répondent.',
    )
    .setVersion('1.0')
    // Toutes les routes exigent l'access token, sauf celles marquées @Public()
    .addCookieAuth(ACCESS_TOKEN_COOKIE)
    .addSecurityRequirements('cookie')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  completeResponses(document);

  SwaggerModule.setup(DOCS_PATH, app, document, {
    customSiteTitle: 'Deskflow API',
    // En production, la documentation se consulte mais n'envoie pas de requêtes ; ailleurs,
    // « Try it out » appelle l'API avec les cookies de session (même origine que /docs)
    swaggerOptions: readOnly ? { supportedSubmitMethods: [] } : {},
  });
}

/**
 * Complète les réponses de chaque route avec les erreurs qu'elle peut renvoyer, déduites de sa
 * forme : 400 si elle valide un body ou une query, 401 si elle n'est pas publique, 404 si elle
 * désigne une ressource. 403 (`@Roles`) et 409 sont déclarés sur les routes. Toutes partagent
 * le même format.
 */
function completeResponses(document: OpenAPIObject) {
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas[ERROR_SCHEMA] = {
    type: 'object',
    required: ['statusCode', 'error', 'message', 'requestId'],
    properties: {
      statusCode: { type: 'integer', example: 400 },
      error: { type: 'string', example: 'Bad Request' },
      message: {
        description: 'Une liste pour les erreurs de validation (un message par champ)',
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        example: ['email : Adresse e-mail invalide'],
      },
      requestId: { type: 'string', format: 'uuid', description: 'Identique à l’en-tête X-Request-Id' },
    },
  };
  const errorContent = {
    'application/json': { schema: { $ref: `#/components/schemas/${ERROR_SCHEMA}` } },
  };

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = pathItem[method];
      if (!operation) {
        continue;
      }
      const responses = operation.responses;
      // Swagger omet le succès dès qu'une route déclare une réponse (ex. 409) : on le rétablit.
      // Une route POST qui répond autre chose que 201 le déclare elle-même (@ApiOkResponse).
      if (!Object.keys(responses).some((status) => /^[23]/.test(status))) {
        responses[method === 'post' ? 201 : 200] = { description: '' };
      }
      // Les routes publiques portent une exigence vide (voir @Public())
      const isPublic = operation.security?.some((requirement) => Object.keys(requirement).length === 0);
      const validatesInput =
        operation.requestBody !== undefined ||
        operation.parameters?.some((parameter) => 'in' in parameter && parameter.in === 'query');

      if (validatesInput) {
        responses[400] ??= { description: 'Requête invalide : un message par champ en erreur' };
      }
      if (!isPublic) {
        responses[401] ??= { description: 'Non connecté ou session expirée' };
      }
      if (path.includes('{')) {
        responses[404] ??= { description: 'Introuvable dans l’organisation' };
      }

      for (const [status, response] of Object.entries(responses)) {
        if (status.startsWith('4') && response && !('$ref' in response)) {
          response.content ??= errorContent;
        }
      }
    }
  }
}

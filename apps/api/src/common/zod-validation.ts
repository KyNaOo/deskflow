import { BadRequestException, Injectable, PipeTransform, type ArgumentMetadata } from '@nestjs/common';
import { z } from 'zod';

/**
 * Pipe globale : valide et transforme (trim, minuscules…) chaque body ou query qui déclare un
 * schéma zod partagé (@deskflow/shared) : `@Body({ schema: loginSchema }) dto: LoginInput`.
 * Le même schéma sert à la documentation OpenAPI. Les paramètres sans schéma
 * (ex. `@Param('id', ParseUUIDPipe)`) passent sans changement.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, { schema }: ArgumentMetadata) {
    if (!(schema instanceof z.ZodType)) {
      return value;
    }

    const result = schema.safeParse(value);
    if (!result.success) {
      // Un message par problème, préfixé par le champ concerné : « email : Adresse e-mail invalide »
      throw new BadRequestException(
        result.error.issues.map(({ path, message }) =>
          path.length > 0 ? `${path.join('.')} : ${message}` : message,
        ),
      );
    }
    return result.data;
  }
}

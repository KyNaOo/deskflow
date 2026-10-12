import { BadRequestException, Injectable, PipeTransform, type ArgumentMetadata } from '@nestjs/common';
import type { z } from 'zod';

/** Classe DTO qui porte son schéma zod : son type d'instance est la sortie du schéma. */
export interface ZodDto<T extends z.ZodType> {
  new (): z.output<T>;
  readonly schema: T;
}

/**
 * Transforme un schéma partagé (@deskflow/shared) en classe utilisable comme type de paramètre :
 * `class LoginDto extends createZodDto(loginSchema) {}` puis `@Body() dto: LoginDto`.
 * Une classe (et non un simple type) est nécessaire : c'est elle que Nest transmet aux pipes.
 */
export function createZodDto<T extends z.ZodType>(schema: T): ZodDto<T> {
  return class {
    static readonly schema = schema;
  } as unknown as ZodDto<T>;
}

/**
 * Pipe globale : valide et transforme (trim, minuscules…) chaque body ou query typé par un DTO
 * zod. Les paramètres sans schéma (ex. `@Param('id', ParseUUIDPipe)`) passent sans changement.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, { metatype }: ArgumentMetadata) {
    const schema = (metatype as Partial<ZodDto<z.ZodType>> | undefined)?.schema;
    if (!schema) {
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

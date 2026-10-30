import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.js';

const signupSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail invalide')),
});

const pipe = new ZodValidationPipe();
const body = (schema?: ArgumentMetadata['schema']): ArgumentMetadata => ({ type: 'body', schema });

function validationMessages(value: unknown): unknown {
  try {
    pipe.transform(value, body(signupSchema));
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse();
  }
  throw new Error('La validation aurait dû échouer');
}

describe('ZodValidationPipe', () => {
  it('renvoie la valeur transformée par le schéma', () => {
    expect(pipe.transform({ email: ' Bob@Acme.TEST ' }, body(signupSchema))).toEqual({
      email: 'bob@acme.test',
    });
  });

  it('refuse une valeur invalide avec un message préfixé par le champ', () => {
    expect(validationMessages({ email: 'not-an-email' })).toMatchObject({
      message: ['email : E-mail invalide'],
    });
  });

  it('refuse un champ inconnu', () => {
    expect(validationMessages({ email: 'bob@acme.test', role: 'ADMIN' })).toMatchObject({
      message: [expect.stringContaining('role')],
    });
  });

  it('laisse passer un paramètre sans schéma (ex. id validé par ParseUUIDPipe)', () => {
    expect(pipe.transform('raw', body(undefined))).toBe('raw');
  });
});

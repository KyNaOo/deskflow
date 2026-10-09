/** Erreur renvoyée par l'API, avec son message lisible (format d'erreur de NestJS). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }

  static async from(response: Response): Promise<ApiError> {
    const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
    return new ApiError(response.status, message ?? "Une erreur est survenue");
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Impossible de joindre le serveur, réessayez.";
}

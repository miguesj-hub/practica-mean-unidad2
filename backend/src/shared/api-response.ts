/**
 * Response Wrapper Pattern.
 *
 * Toda salida HTTP del sistema —exitosa o fallida— viaja con la misma
 * envoltura. El cliente distingue ambos casos leyendo un único campo
 * discriminante (`success`) en vez de inferirlo de la forma del payload.
 */

/** Detalle de un campo que no superó la validación perimetral. */
export interface FieldError {
  campo: string;
  mensaje: string;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
  /** Presente sólo cuando el fallo proviene de un DTO. */
  errors?: FieldError[];
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/** Envuelve una respuesta exitosa. */
export const ok = <T>(data: T): SuccessResponse<T> => ({ success: true, data });

/** Envuelve una respuesta fallida. */
export const fail = (
  code: string,
  message: string,
  errors: FieldError[] = []
): ErrorResponse => ({
  success: false,
  error: { code, message },
  // `exactOptionalPropertyTypes` prohíbe asignar `undefined` explícito:
  // la clave existe sólo si hay detalle que reportar.
  ...(errors.length > 0 ? { errors } : {})
});

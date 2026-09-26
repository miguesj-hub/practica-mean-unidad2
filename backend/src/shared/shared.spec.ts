import { describe, expect, it } from '@jest/globals';
import { fail, ok } from './api-response.js';
import { AppError, NotFoundError, ValidationError } from './app-error.js';

/** Prueba unitaria de los bloques compartidos: envoltura y errores de aplicación. */
describe('🧪 Unit Test: Response Wrapper', () => {
  it('ok() debería envolver los datos con success: true', () => {
    expect(ok({ id: '1' })).toEqual({ success: true, data: { id: '1' } });
  });

  it('fail() debería omitir la clave errors cuando no hay detalle', () => {
    const response = fail('NOT_FOUND', 'No existe');

    expect(response).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'No existe' }
    });
    expect(response).not.toHaveProperty('errors');
  });

  it('fail() debería incluir errors cuando hay detalle de campos', () => {
    const errors = [{ campo: 'nombre', mensaje: 'Requerido' }];

    expect(fail('VALIDATION_ERROR', 'Inválido', errors).errors).toEqual(errors);
  });
});

describe('🧪 Unit Test: AppError', () => {
  it('NotFoundError debería ser un AppError 404 con mensaje por defecto', () => {
    const error = new NotFoundError();

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('El recurso solicitado no existe');
    expect(error.name).toBe('NotFoundError');
    expect(error.errors).toEqual([]);
  });

  it('ValidationError debería ser un AppError 400 con el detalle de campos', () => {
    const errors = [{ campo: 'sueldo', mensaje: 'Debe ser positivo' }];
    const error = new ValidationError(errors);

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.errors).toEqual(errors);
    expect(error.name).toBe('ValidationError');
  });
});

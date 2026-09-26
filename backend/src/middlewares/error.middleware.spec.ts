import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { z } from 'zod';
import { errorHandler, notFoundHandler } from './error.middleware.js';
import { fail } from '../shared/api-response.js';
import { NotFoundError, ValidationError } from '../shared/app-error.js';

/**
 * Prueba unitaria del interceptor global de errores.
 *
 * Verifica que cada tipo de excepción se traduzca al código HTTP y a la
 * envoltura correctos, y que un fallo imprevisto jamás exponga su detalle.
 */
describe('🧪 Unit Test: error middleware (Seguridad & Contrato de errores)', () => {
  let mockResponse: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  const req = { method: 'GET', originalUrl: '/api/v1/nada' } as Request;
  const next = jest.fn() as unknown as NextFunction;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = { status: statusMock } as Partial<Response>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('notFoundHandler debería responder 404 ROUTE_NOT_FOUND con método y ruta', () => {
    notFoundHandler(req, mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith(
      fail('ROUTE_NOT_FOUND', 'No existe la ruta GET /api/v1/nada')
    );
  });

  it('Debería traducir un AppError a su statusCode y code', () => {
    errorHandler(new NotFoundError('No existe'), req, mockResponse as Response, next);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith(fail('NOT_FOUND', 'No existe'));
  });

  it('Debería incluir el detalle de campos de un ValidationError', () => {
    const errors = [{ campo: 'sueldo', mensaje: 'El sueldo debe ser mayor a 0' }];

    errorHandler(new ValidationError(errors), req, mockResponse as Response, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      fail('VALIDATION_ERROR', 'La petición no superó la validación de esquema', errors)
    );
  });

  it('Debería traducir un ZodError suelto a 400 VALIDATION_ERROR', () => {
    const result = z.object({ nombre: z.string() }).safeParse({});

    errorHandler(result.error, req, mockResponse as Response, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        errors: [expect.objectContaining({ campo: 'nombre' })]
      })
    );
  });

  it('Debería traducir el SyntaxError de express.json() a 400 MALFORMED_JSON', () => {
    const err = Object.assign(new SyntaxError('Unexpected token }'), { body: '{"a":}' });

    errorHandler(err, req, mockResponse as Response, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      fail('MALFORMED_JSON', 'El cuerpo de la petición no es un JSON válido', [
        { campo: 'body', mensaje: 'Unexpected token }' }
      ])
    );
  });

  it('Debería responder 500 genérico sin exponer el mensaje ni el stack', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('password=secreta en la cadena de conexión');

    errorHandler(err, req, mockResponse as Response, next);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith(
      fail('INTERNAL_ERROR', 'Ocurrió un error inesperado en el servidor')
    );
    expect(JSON.stringify(jsonMock.mock.calls)).not.toContain('secreta');
    // El detalle sí queda registrado del lado del servidor
    expect(consoleSpy).toHaveBeenCalledWith('❌ [Error no controlado]:', err);
  });

  it('Debería tratar un SyntaxError sin body como error no controlado', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(new SyntaxError('interno'), req, mockResponse as Response, next);

    expect(statusMock).toHaveBeenCalledWith(500);
  });
});

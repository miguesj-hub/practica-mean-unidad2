import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createEmpleadoController } from './empleados.controllers.js';
import type { IEmployeeRepository } from '../domain/employee.repository.js';
import type { Employee } from '../domain/employee.entity.js';
import { ok } from '../shared/api-response.js';
import { NotFoundError } from '../shared/app-error.js';

/**
 * Prueba unitaria de caja blanca del controlador.
 *
 * El controlador se construye con un doble de prueba del puerto
 * `IEmployeeRepository`: no se importa Mongoose, no se abre conexión y no
 * hace falta MongoDB ni Docker. Si el controlador dependiera del modelo
 * concreto, este archivo no podría existir sin base de datos.
 *
 * En ESM, `jest` no es un global: se importa desde `@jest/globals`.
 */
describe('🧪 Unit Test: EmpleadoController (Mantenibilidad & Testabilidad)', () => {
  let controller: ReturnType<typeof createEmpleadoController>;
  let mockRepository: jest.Mocked<IEmployeeRepository>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  const fakeEmployee: Employee = {
    id: '66f0c0ffee0000000000abcd',
    nombre: 'Andrés Mendoza',
    cargo: 'Arquitecto',
    departamento: 'TI',
    sueldo: 4000,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z')
  };

  beforeEach(() => {
    // 1. Mock 100% aislado de la interfaz (cero dependencia de Mongoose)
    mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };

    controller = createEmpleadoController(mockRepository);

    // 2. Mock de los objetos del ciclo de vida de Express
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = { status: statusMock } as Partial<Response>;
  });

  it('Debería retornar un estado 200 y la lista de empleados de la abstracción', async () => {
    const fakeEmployees = [fakeEmployee];

    // Comportamiento esperado de la abstracción
    mockRepository.findAll.mockResolvedValue(fakeEmployees);
    mockRequest = {};

    await controller.getEmpleados(mockRequest as Request, mockResponse as Response);

    // Verificaciones asertivas del contrato (envuelto por el Response Wrapper)
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(ok(fakeEmployees));
    expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
  });

  it('Debería retornar 200 y el empleado cuando el id existe', async () => {
    mockRepository.findById.mockResolvedValue(fakeEmployee);
    mockRequest = { params: { id: fakeEmployee.id } };

    await controller.getEmpleadoById(
      mockRequest as Request<{ id: string }>,
      mockResponse as Response
    );

    expect(mockRepository.findById).toHaveBeenCalledWith(fakeEmployee.id);
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(ok(fakeEmployee));
  });

  it('Debería lanzar NotFoundError cuando el id no existe, sin responder', async () => {
    mockRepository.findById.mockResolvedValue(null);
    mockRequest = { params: { id: 'inexistente' } };

    await expect(
      controller.getEmpleadoById(
        mockRequest as Request<{ id: string }>,
        mockResponse as Response
      )
    ).rejects.toBeInstanceOf(NotFoundError);

    // La traducción a 404 es responsabilidad del middleware global
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('Debería retornar 201 y delegar el registro al repositorio', async () => {
    const { id, createdAt, updatedAt, ...body } = fakeEmployee;
    mockRepository.create.mockResolvedValue(fakeEmployee);
    mockRequest = { body };

    await controller.addEmpleado(mockRequest as Request, mockResponse as Response);

    expect(mockRepository.create).toHaveBeenCalledWith(body);
    expect(statusMock).toHaveBeenCalledWith(201);
    expect(jsonMock).toHaveBeenCalledWith(ok(fakeEmployee));
  });

  it('Debería retornar 200 con el id eliminado', async () => {
    mockRepository.delete.mockResolvedValue(true);
    mockRequest = { params: { id: fakeEmployee.id } };

    await controller.deleteEmpleado(
      mockRequest as Request<{ id: string }>,
      mockResponse as Response
    );

    expect(mockRepository.delete).toHaveBeenCalledWith(fakeEmployee.id);
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(ok({ id: fakeEmployee.id }));
  });
});

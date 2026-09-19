import type { Request, Response } from 'express';
import type { CreateEmployeeDto, EmployeeIdParam, UpdateEmployeeDto } from '../dtos/employee.dto.js';
import type { Employee } from '../domain/employee.entity.js';
import type { IEmployeeRepository } from '../domain/employee.repository.js';
import { ok, type ApiResponse } from '../shared/api-response.js';
import { NotFoundError } from '../shared/app-error.js';

/**
 * Controlador de empleados.
 *
 * Depende del puerto `IEmployeeRepository`, nunca de Mongoose ni del modelo.
 * No hay `import mongoose` en este archivo: removerlo es imposible porque
 * nunca existió, y el sistema compila igual.
 *
 * Recibe el repositorio por inyección de dependencias (factory), de modo que
 * el controlador es testeable con un repositorio falso en memoria.
 *
 * Tras el Reto 2 el controlador tampoco valida ni formatea errores: cuando
 * llega aquí, la petición ya pasó el DTO; cuando algo falta, lanza y el
 * middleware global traduce. Toda salida viaja envuelta en `ok()`.
 */
export const createEmpleadoController = (repository: IEmployeeRepository) => ({
  /** Consulta completa. */
  async getEmpleados(_req: Request, res: Response<ApiResponse<Employee[]>>) {
    const empleados = await repository.findAll();
    res.json(ok(empleados));
  },

  /** Consulta atómica por identificador único. */
  async getEmpleadoById(
    req: Request<EmployeeIdParam>,
    res: Response<ApiResponse<Employee>>
  ) {
    const empleado = await repository.findById(req.params.id);
    if (!empleado) {
      throw new NotFoundError(`No existe un empleado con id ${req.params.id}`);
    }
    res.json(ok(empleado));
  },

  /** Registro. */
  async addEmpleado(
    req: Request<unknown, unknown, CreateEmployeeDto>,
    res: Response<ApiResponse<Employee>>
  ) {
    const empleado = await repository.create(req.body);
    res.status(201).json(ok(empleado));
  },

  /** Actualización parcial o total. */
  async updateEmpleado(
    req: Request<EmployeeIdParam, unknown, UpdateEmployeeDto>,
    res: Response<ApiResponse<Employee>>
  ) {
    const empleado = await repository.update(req.params.id, req.body);
    if (!empleado) {
      throw new NotFoundError(`No existe un empleado con id ${req.params.id}`);
    }
    res.json(ok(empleado));
  },

  /** Eliminación. */
  async deleteEmpleado(
    req: Request<EmployeeIdParam>,
    res: Response<ApiResponse<{ id: string }>>
  ) {
    const eliminado = await repository.delete(req.params.id);
    if (!eliminado) {
      throw new NotFoundError(`No existe un empleado con id ${req.params.id}`);
    }
    res.json(ok({ id: req.params.id }));
  }
});

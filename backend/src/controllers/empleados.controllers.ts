import type { Request, Response } from 'express';
import type { IEmployeeRepository } from '../domain/employee.repository.js';

/**
 * Controlador de empleados.
 *
 * Depende del puerto `IEmployeeRepository`, nunca de Mongoose ni del modelo.
 * No hay `import mongoose` en este archivo: removerlo es imposible porque
 * nunca existió, y el sistema compila igual.
 *
 * Recibe el repositorio por inyección de dependencias (factory), de modo que
 * el controlador es testeable con un repositorio falso en memoria.
 */
export const createEmpleadoController = (repository: IEmployeeRepository) => ({
  /** Consulta completa. */
  async getEmpleados(_req: Request, res: Response) {
    const empleados = await repository.findAll();
    res.json(empleados);
  },

  /** Consulta atómica por identificador único. */
  async getEmpleadoById(req: Request<{ id: string }>, res: Response) {
    const empleado = await repository.findById(req.params.id);
    res.json(empleado);
  },

  /** Registro. */
  async addEmpleado(req: Request, res: Response) {
    await repository.create(req.body);
    res.json({ status: 'Empleado guardado' });
  },

  /** Actualización parcial o total. */
  async updateEmpleado(req: Request<{ id: string }>, res: Response) {
    await repository.update(req.params.id, req.body);
    res.json({ status: 'Empleado actualizado' });
  },

  /** Eliminación. */
  async deleteEmpleado(req: Request<{ id: string }>, res: Response) {
    await repository.delete(req.params.id);
    res.json({ status: 'Empleado eliminado' });
  }
});

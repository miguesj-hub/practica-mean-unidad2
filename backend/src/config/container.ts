import type { IEmployeeRepository } from '../domain/employee.repository.js';
import { MongooseEmployeeRepository } from '../infrastructure/persistence/mongoose/employee.mongoose.repository.js';

/**
 * Composition root: el único punto del sistema donde se decide QUÉ
 * implementación concreta satisface el puerto de persistencia.
 *
 * Para cambiar de motor (o inyectar un doble de pruebas) se cambia
 * esta línea y nada más.
 */
export const employeeRepository: IEmployeeRepository = new MongooseEmployeeRepository();

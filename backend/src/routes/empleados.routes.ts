import { Router } from 'express';
import { employeeRepository } from '../config/container.js';
import { createEmpleadoController } from '../controllers/empleados.controllers.js';
import {
  createEmployeeSchema,
  employeeIdParamSchema,
  updateEmployeeSchema
} from '../dtos/employee.dto.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = Router();
const empleado = createEmpleadoController(employeeRepository);

// El DTO se monta como middleware previo: la validación es parte de la
// definición de la ruta, no una responsabilidad del controlador.
router.get('/empleados', empleado.getEmpleados);

router.get(
  '/empleados/:id',
  validate({ params: employeeIdParamSchema }),
  empleado.getEmpleadoById
);

router.post(
  '/empleados',
  validate({ body: createEmployeeSchema }),
  empleado.addEmpleado
);

router.put(
  '/empleados/:id',
  validate({ params: employeeIdParamSchema, body: updateEmployeeSchema }),
  empleado.updateEmpleado
);

router.delete(
  '/empleados/:id',
  validate({ params: employeeIdParamSchema }),
  empleado.deleteEmpleado
);

export default router;

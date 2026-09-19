import { Router } from 'express';
import { employeeRepository } from '../config/container.js';
import { createEmpleadoController } from '../controllers/empleados.controllers.js';

const router = Router();
const empleado = createEmpleadoController(employeeRepository);

router.get('/empleados', empleado.getEmpleados);
router.get('/empleados/:id', empleado.getEmpleadoById);
router.post('/empleados', empleado.addEmpleado);
router.put('/empleados/:id', empleado.updateEmpleado);
router.delete('/empleados/:id', empleado.deleteEmpleado);

export default router;

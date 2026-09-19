import express from 'express'; 
const router=express.Router(); 
import empleado from '../controllers/empleados.controllers'; 

router.get('/empleados',empleado.getEmpleado); 
router.post('/empleados', empleado.addEmpleado); 
router.put('/empleados/:id', empleado.updateEmpleado); 
router.delete('/empleados/:id', empleado.deleteEmpleado); 

export default router;
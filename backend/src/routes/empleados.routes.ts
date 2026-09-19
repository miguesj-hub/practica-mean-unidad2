const express= require('express'); 
const router=express.Router(); 
const empleado=require('../controllers/empleados.controllers'); 

router.get('/empleados',empleado.getEmpleado); 
router.post('/empleados', empleado.addEmpleado); 
router.put('/empleados', empleado.updateEmpleado); 
router.delete('/empleados', empleado.deleteEmpleado); 

module.exports=router;
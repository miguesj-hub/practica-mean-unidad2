const empleadoController:any={};

import Empleado from '../models/empleado';

empleadoController.getEmpleado=async(req,res)=>{
    const empleados=await Empleado.find();
    res.json(empleados);
}

empleadoController.addEmpleado=async(req,res)=>{
    const empleado=new Empleado(req.body);
    await empleado.save();
    res.json({status:'Empleado guardado'});
}

empleadoController.updateEmpleado=async(req,res)=>{
    const {id}=req.params;
    const empleado=await Empleado.findByIdAndUpdate(id,req.body);
    res.json({status:'Empleado actualizado'});
}
empleadoController.deleteEmpleado=async(req,res)=>{
    const {id}=req.params;
    await Empleado.findByIdAndDelete(id);
    res.json({status:'Empleado eliminado'});
}
export default empleadoController;

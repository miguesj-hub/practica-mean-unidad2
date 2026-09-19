import {Schema, model} from 'mongoose';
const empleadoSchema=new Schema({

 nombre:{type:String, required:true},
 cargo:{type:String, required: true},
 departamento:{type:String, required:true},
 sueldo:{type:Number, required:true}
}, {    
     timestamps:true,
 versionKey:false
})
export default model("Empleado",empleadoSchema);
import { Schema, model } from 'mongoose';

/**
 * Detalle de infraestructura: el schema del ODM.
 * Vive aquí y sólo aquí; ninguna capa superior lo importa.
 */
const empleadoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    cargo: { type: String, required: true },
    departamento: { type: String, required: true },
    sueldo: { type: Number, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

export const EmpleadoModel = model('Empleado', empleadoSchema);

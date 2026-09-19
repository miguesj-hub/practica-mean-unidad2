import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDatabase } from './config/database';
import empleadosRoutes from './routes/empleados.routes';


 
const app=express(); 
const port = 3000 
connectDatabase(); // Conexión a la base de datos
app.use(morgan('dev'));
 
app.use(express.json());
app.use(cors()); 
app.use('/api/v1', empleadosRoutes);

app.listen(port, ()=>{ 
    console.log('Servidor escuchando en el puerto ' + port); 
})
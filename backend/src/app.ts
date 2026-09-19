import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import empleadosRoutes from './routes/empleados.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

/** Ensamblado de la aplicación HTTP. No sabe nada de persistencia. */
const app = express();

// settings
app.set('puerto', process.env['PORT'] ?? 3000);
app.set('nombreApp', 'Gestión de empleados');

// middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(cors());

// routes
app.use('/api/v1', empleadosRoutes);

// El orden importa: primero las rutas conocidas, luego el 404 genérico y,
// al final de la cadena, el interceptor global de errores.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

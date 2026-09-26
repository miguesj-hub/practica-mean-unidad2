import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import empleadosRoutes from './routes/empleados.routes.js';
import { openApiDocument } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

/** Ensamblado de la aplicación HTTP. No sabe nada de persistencia. */
const app = express();

// settings
app.set('puerto', process.env['PORT'] ?? 3000);
app.set('nombreApp', 'Gestión de empleados');

// middlewares
app.use(morgan('dev'));
app.use(express.json());
app.use(
  cors({
    // El frontend vive en Azure Static Web Apps (producción y entornos de PR);
    // localhost cubre ng serve. Swagger se sirve desde el mismo origen.
    origin: [
      /^https:\/\/blue-sand-076769b1e(-\d+)?\.(\w+\.)?\d\.azurestaticapps\.net$/,
      'http://localhost:4200'
    ]
  })
);

// documentación interactiva (antes del 404 genérico)
app.get('/api/docs.json', (_req, res) => {
  res.json(openApiDocument);
});
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: 'API de Gestión de Empleados'
  })
);

// routes
app.use('/api/v1', empleadosRoutes);

// El orden importa: primero las rutas conocidas, luego el 404 genérico y,
// al final de la cadena, el interceptor global de errores.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

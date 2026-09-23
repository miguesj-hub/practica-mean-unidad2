# Gestión de Empleados

CRUD de personal con stack MEAN. Es la práctica de la Unidad 2 de la Maestría en Software: se parte de un código base con deuda técnica deliberada y se refactoriza en cuatro retos. El enunciado y la rúbrica están en [REQUISITOS.md](REQUISITOS.md).

**Backend** — Express 5 + TypeScript sobre MongoDB. Patrón Repository (los controladores no conocen Mongoose), validación con Zod y todas las respuestas envueltas en un formato único.

**Frontend** — Angular 22 standalone. El estado vive en un servicio con `BehaviorSubject`; la vista es un componente orquestador que delega en tres presentacionales.

## Antes de empezar

Necesitas Node 24+ y MongoDB escuchando en el 27017. Si no lo tienes corriendo:

```bash
docker run -d --name mongo-p3 -p 27017:27017 mongo    # la primera vez
docker start mongo-p3                                  # las siguientes
```

## Correrlo

Dos terminales, una por servicio.

```bash
cd backend && npm install && npm run dev      # http://127.0.0.1:3000
```

```bash
cd frontend && npm install && npm start       # http://localhost:4200
```

Ojo con el host: el backend responde en `127.0.0.1` y el dev server de Angular solo en `localhost` (se vincula a `::1`). Si los intercambias, no responde ninguno.

## Endpoints

Todos cuelgan de `/api/v1`. La documentación interactiva queda en **http://127.0.0.1:3000/api/docs**, generada desde los mismos esquemas de Zod que validan las peticiones.

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/empleados` | 200 con el listado |
| GET | `/empleados/:id` | 200, o 404 si no existe |
| POST | `/empleados` | 201 con la entidad creada |
| PUT | `/empleados/:id` | 200 con la entidad actualizada |
| DELETE | `/empleados/:id` | 200 con el id eliminado |

El éxito viaja como `{ success: true, data }` y el fallo como `{ success: false, error: { code, message }, errors? }`. Un payload inválido devuelve 400 con la lista de campos que fallaron; nunca se filtra un stack trace.

## Pruebas

```bash
npx newman run Gestion-Empleados.postman_collection.json    # API: 12 peticiones, 31 aserciones
cd frontend && npm test                                      # Angular: 28 pruebas
```

La colección de Postman cubre el CRUD y siete casos de error. Las capturas de cada petición están en [`imagenes-funcionamiento/`](imagenes-funcionamiento).

## Estructura

```
backend/src/
  domain/            entidad y puerto IEmployeeRepository
  infrastructure/    adaptador de Mongoose y conexión
  config/            composition root: qué implementación satisface el puerto
  routes/            monta los DTO antes de cada controlador
  controllers/       dependen del puerto, no del ODM
  dtos/              esquemas Zod
  middlewares/       validación perimetral e interceptor de errores
  shared/            envoltura de respuesta y jerarquía de errores
  docs/              documento OpenAPI

frontend/src/app/
  services/          EmployeeService: BehaviorSubject privados, Observable$ públicos
  components/        presentacionales: formulario, rejilla y avisos
  app.ts             orquestador, consume los flujos con async pipe
```

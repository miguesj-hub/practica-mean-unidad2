import { z } from 'zod';
import {
  createEmployeeSchema,
  employeeIdParamSchema,
  updateEmployeeSchema
} from '../dtos/employee.dto.js';

/**
 * Documento OpenAPI 3.1.
 *
 * Los esquemas NO se escriben a mano: se derivan de los mismos DTO de Zod
 * que validan las peticiones en tiempo de ejecución. Una sola fuente de
 * verdad, así que la documentación no puede quedar desfasada del validador
 * —si alguien cambia una regla del DTO, Swagger lo refleja al reiniciar.
 */

/** Convierte un schema de Zod a JSON Schema y quita la clave `$schema`. */
const toSchema = (schema: z.ZodType): Record<string, unknown> => {
  const { $schema: _omitido, ...rest } = z.toJSONSchema(schema, {
    io: 'input',
    unrepresentable: 'any'
  }) as Record<string, unknown>;
  return rest;
};

/**
 * Forma de la entidad que devuelve la API. Se construye extendiendo el DTO
 * de creación, de modo que los campos de negocio se mantienen alineados.
 */
const employeeSchema = createEmployeeSchema.extend({
  id: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime()
});

/** Envoltura de éxito del Response Wrapper, parametrizada por su `data`. */
const success = (data: Record<string, unknown>): Record<string, unknown> => ({
  type: 'object',
  required: ['success', 'data'],
  properties: {
    success: { type: 'boolean', const: true },
    data
  }
});

/** Referencia a una respuesta de error ya definida en `components`. */
const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' }
    }
  }
});

const jsonBody = (schema: Record<string, unknown>) => ({
  required: true,
  content: { 'application/json': { schema } }
});

const okResponse = (description: string, data: Record<string, unknown>) => ({
  description,
  content: { 'application/json': { schema: success(data) } }
});

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'Identificador del empleado.',
  schema: (toSchema(employeeIdParamSchema)['properties'] as Record<string, unknown>)['id']
};

const respuestasComunes = {
  '400': errorResponse('La petición no superó la validación del DTO.'),
  '500': errorResponse('Fallo imprevisto. El detalle se registra en el servidor, nunca se expone.')
};

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'API de Gestión de Empleados',
    version: '2.0.0',
    description:
      'CRUD de empleados sobre arquitectura desacoplada.\n\n' +
      '**Patrón Repository:** la capa HTTP depende del puerto `IEmployeeRepository`, ' +
      'nunca del ODM.\n\n' +
      '**Response Wrapper:** toda salida viaja envuelta. Éxito: `{ success: true, data }`. ' +
      'Fallo: `{ success: false, error: { code, message }, errors? }`.\n\n' +
      '**Validación perimetral:** los esquemas de esta página se generan desde los DTO de Zod ' +
      'que rechazan la petición antes de que el controlador se ejecute.'
  },
  servers: [{ url: 'http://127.0.0.1:3000/api/v1', description: 'Entorno local' }],
  // Declaración explícita: ningún endpoint exige autenticación. La práctica
  // no contempla una capa de seguridad; el arreglo vacío lo documenta en
  // vez de dejarlo al supuesto del lector.
  security: [],
  tags: [{ name: 'Empleados', description: 'Operaciones sobre el personal.' }],
  paths: {
    '/empleados': {
      get: {
        tags: ['Empleados'],
        summary: 'Lista todos los empleados',
        operationId: 'listarEmpleados',
        responses: {
          '200': okResponse('Listado completo.', {
            type: 'array',
            items: { $ref: '#/components/schemas/Employee' }
          }),
          '500': respuestasComunes['500']
        }
      },
      post: {
        tags: ['Empleados'],
        summary: 'Registra un empleado',
        operationId: 'crearEmpleado',
        description:
          'El DTO rechaza claves desconocidas (`additionalProperties: false`), nombres de ' +
          'menos de 3 caracteres y sueldos no positivos.',
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateEmployeeDto' }),
        responses: {
          '201': okResponse('Empleado creado. Devuelve la entidad persistida.', {
            $ref: '#/components/schemas/Employee'
          }),
          ...respuestasComunes
        }
      }
    },
    '/empleados/{id}': {
      get: {
        tags: ['Empleados'],
        summary: 'Consulta un empleado por su identificador',
        operationId: 'consultarEmpleadoPorId',
        parameters: [idParameter],
        responses: {
          '200': okResponse('Empleado encontrado.', { $ref: '#/components/schemas/Employee' }),
          '404': errorResponse('No existe un empleado con ese identificador.'),
          ...respuestasComunes
        }
      },
      put: {
        tags: ['Empleados'],
        summary: 'Actualiza un empleado',
        operationId: 'actualizarEmpleado',
        description:
          'Actualización parcial: todos los campos son opcionales, pero un cuerpo vacío ' +
          'se rechaza con 400. Esa regla se expresa con un `refine` de Zod y no tiene ' +
          'representación en JSON Schema, por lo que no aparece en el esquema de abajo.',
        parameters: [idParameter],
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateEmployeeDto' }),
        responses: {
          '200': okResponse('Empleado actualizado. Devuelve la entidad ya modificada.', {
            $ref: '#/components/schemas/Employee'
          }),
          '404': errorResponse('No existe un empleado con ese identificador.'),
          ...respuestasComunes
        }
      },
      delete: {
        tags: ['Empleados'],
        summary: 'Elimina un empleado',
        operationId: 'eliminarEmpleado',
        parameters: [idParameter],
        responses: {
          '200': okResponse('Empleado eliminado.', {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'string' } }
          }),
          '404': errorResponse('No existe un empleado con ese identificador.'),
          ...respuestasComunes
        }
      }
    }
  },
  components: {
    schemas: {
      Employee: toSchema(employeeSchema),
      CreateEmployeeDto: toSchema(createEmployeeSchema),
      UpdateEmployeeDto: toSchema(updateEmployeeSchema),
      ErrorResponse: {
        type: 'object',
        required: ['success', 'error'],
        properties: {
          success: { type: 'boolean', const: false },
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                description: 'Código estable del fallo.',
                examples: [
                  'VALIDATION_ERROR',
                  'NOT_FOUND',
                  'MALFORMED_JSON',
                  'ROUTE_NOT_FOUND',
                  'INTERNAL_ERROR'
                ]
              },
              message: { type: 'string' }
            }
          },
          errors: {
            type: 'array',
            description: 'Presente sólo cuando el fallo proviene de un DTO.',
            items: {
              type: 'object',
              required: ['campo', 'mensaje'],
              properties: {
                campo: { type: 'string' },
                mensaje: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }
};

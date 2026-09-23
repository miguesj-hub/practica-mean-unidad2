export interface Employee {
  id: string;
  nombre: string;
  cargo: string;
  departamento: string;
  sueldo: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeDraft {
  nombre: string;
  cargo: string;
  departamento: string;
  sueldo: number;
}

export interface Notice {
  tipo: 'exito' | 'error';
  texto: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string };
  errors?: { campo: string; mensaje: string }[];
}

export const EMPTY_DRAFT: EmployeeDraft = {
  nombre: '',
  cargo: '',
  departamento: '',
  sueldo: 0
};

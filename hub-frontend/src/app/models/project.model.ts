export interface Project {
  id: number;
  nombre: string;
  descripcion: string;
  imagen: string;
  url: string;
}

export interface ProjectPayload {
  nombre: string;
  descripcion: string;
  imagen: string;
  url: string;
}

import { Component, OnInit } from '@angular/core';

import { Project } from '../../models/project.model';
import { ProjectService } from '../../services/project.service';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  proyectos: Project[] = [];
  cargando = true;
  mensajeError = '';

  constructor(private readonly projectService: ProjectService) {}

  ngOnInit(): void {
    this.cargarProyectos();
  }

  abrirProyecto(proyecto: Project): void {
    const targetUrl = proyecto.url.startsWith('http') ? proyecto.url : `https://${proyecto.url}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  obtenerIniciales(nombre: string): string {
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((fragment) => fragment.charAt(0).toUpperCase())
      .join('');
  }

  obtenerDominio(url: string): string {
    return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }

  get proyectosOrdenados(): Project[] {
    return [...this.proyectos].sort((left, right) => right.id - left.id);
  }

  get proyectosDestacados(): Project[] {
    return this.proyectosOrdenados;
  }

  private cargarProyectos(): void {
    this.cargando = true;
    this.projectService.obtenerProyectos().subscribe({
      next: (projects) => {
        this.proyectos = projects;
        this.cargando = false;
      },
      error: () => {
        this.mensajeError = 'No se pudieron cargar los proyectos.';
        this.cargando = false;
      },
    });
  }
}

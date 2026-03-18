import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, finalize, of, shareReplay, tap, timeout } from 'rxjs';

import { environment } from '../../environments/environment';
import { Project, ProjectPayload } from '../models/project.model';

@Injectable({
  providedIn: 'root',
})
export class ProjectService {
  private readonly projectsUrl = `${environment.apiUrl}/projects`;
  private readonly projectsStorageKey = 'hub_demo_projects';
  private readonly authBypass = environment.authBypass;
  private readonly projectsFallback: Project[] = [
    {
      id: 1,
      nombre: 'Habita',
      descripcion: 'Portal principal',
      imagen: '/images/Habita.png',
      url: 'https://habitanakr.netlify.app/',
    },
  ];
  private projectsCache: Project[] | null = null;
  private projectsRequest$?: Observable<Project[]>;

  constructor(private readonly http: HttpClient) {}

  obtenerProyectos(forceRefresh = false): Observable<Project[]> {
    if (this.authBypass) {
      const projects = this.obtenerProyectosDemo();
      this.projectsCache = projects;
      return of(projects);
    }

    if (!forceRefresh && this.projectsCache) {
      return of(this.projectsCache);
    }

    if (!forceRefresh && this.projectsRequest$) {
      return this.projectsRequest$;
    }

    const request$ = this.http.get<Project[]>(this.projectsUrl).pipe(
      timeout(5000),
      catchError(() => of(this.projectsFallback)),
      tap((projects) => {
        this.projectsCache = projects;
      }),
      finalize(() => {
        this.projectsRequest$ = undefined;
      }),
      shareReplay(1)
    );

    this.projectsRequest$ = request$;
    return request$;
  }

  actualizarProyecto(projectId: number, payload: ProjectPayload): Observable<Project> {
    if (this.authBypass) {
      const projects = this.obtenerProyectosDemo();
      const projectIndex = projects.findIndex((project) => project.id === projectId);

      if (projectIndex === -1) {
        return of(this.projectsFallback[0]);
      }

      const updatedProject: Project = {
        ...projects[projectIndex],
        ...payload,
      };

      projects[projectIndex] = updatedProject;
      this.guardarProyectosDemo(projects);
      this.projectsCache = projects;
      return of(updatedProject);
    }

    return this.http.put<Project>(`${this.projectsUrl}/${projectId}`, payload).pipe(
      tap((updatedProject) => {
        if (!this.projectsCache) {
          return;
        }

        this.projectsCache = this.projectsCache.map((project) =>
          project.id === updatedProject.id ? updatedProject : project
        );
      })
    );
  }

  crearProyecto(payload: ProjectPayload): Observable<Project> {
    if (this.authBypass) {
      const projects = this.obtenerProyectosDemo();
      const newProject: Project = {
        id: projects.length ? Math.max(...projects.map((project) => project.id)) + 1 : 1,
        ...payload,
      };

      const updatedProjects = [...projects, newProject];
      this.guardarProyectosDemo(updatedProjects);
      this.projectsCache = updatedProjects;
      return of(newProject);
    }

    return this.http.post<Project>(this.projectsUrl, payload).pipe(
      tap((newProject) => {
        this.projectsCache = this.projectsCache ? [...this.projectsCache, newProject] : [newProject];
      })
    );
  }

  eliminarProyecto(projectId: number): Observable<void> {
    if (this.authBypass) {
      const updatedProjects = this.obtenerProyectosDemo().filter(
        (project) => project.id !== projectId
      );
      this.guardarProyectosDemo(updatedProjects);
      this.projectsCache = updatedProjects;
      return of(void 0);
    }

    return this.http.delete<void>(`${this.projectsUrl}/${projectId}`).pipe(
      tap(() => {
        if (!this.projectsCache) {
          return;
        }

        this.projectsCache = this.projectsCache.filter((project) => project.id !== projectId);
      })
    );
  }

  private obtenerProyectosDemo(): Project[] {
    try {
      const rawProjects = localStorage.getItem(this.projectsStorageKey);

      if (!rawProjects) {
        this.guardarProyectosDemo(this.projectsFallback);
        return [...this.projectsFallback];
      }

      const projects = JSON.parse(rawProjects) as Project[];
      return projects.length ? projects : [...this.projectsFallback];
    } catch {
      return [...this.projectsFallback];
    }
  }

  private guardarProyectosDemo(projects: Project[]): void {
    localStorage.setItem(this.projectsStorageKey, JSON.stringify(projects));
  }
}

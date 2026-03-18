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
    return this.http.post<Project>(this.projectsUrl, payload).pipe(
      tap((newProject) => {
        this.projectsCache = this.projectsCache ? [...this.projectsCache, newProject] : [newProject];
      })
    );
  }

  eliminarProyecto(projectId: number): Observable<void> {
    return this.http.delete<void>(`${this.projectsUrl}/${projectId}`).pipe(
      tap(() => {
        if (!this.projectsCache) {
          return;
        }

        this.projectsCache = this.projectsCache.filter((project) => project.id !== projectId);
      })
    );
  }
}

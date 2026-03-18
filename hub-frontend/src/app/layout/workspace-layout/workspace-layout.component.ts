import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-workspace-layout',
  standalone: false,
  templateUrl: './workspace-layout.component.html',
  styleUrl: './workspace-layout.component.scss',
})
export class WorkspaceLayoutComponent implements OnInit, OnDestroy {
  usuarioActual: User | null = null;
  menuUsuarioAbierto = false;
  etiquetaSeccion = 'Board';
  sidebarAbierto = true;
  viewportMovil = false;

  private routeSubscription?: Subscription;
  private userSubscription?: Subscription;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.actualizarEstadoViewport();
    this.sidebarAbierto = !this.viewportMovil;
    this.usuarioActual = this.authService.obtenerUsuarioActualSnapshot();
    this.actualizarEtiquetaSeccion();

    this.userSubscription = this.authService.obtenerUsuarioActual().subscribe((user) => {
      this.usuarioActual = user;
    });

    this.routeSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.menuUsuarioAbierto = false;
        this.actualizarEtiquetaSeccion();

        if (this.viewportMovil) {
          this.sidebarAbierto = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
  }

  alternarMenuUsuario(event: MouseEvent): void {
    event.stopPropagation();
    this.menuUsuarioAbierto = !this.menuUsuarioAbierto;
  }

  alternarSidebar(): void {
    this.sidebarAbierto = !this.sidebarAbierto;
    this.menuUsuarioAbierto = false;
  }

  cerrarSidebar(): void {
    if (this.viewportMovil) {
      this.sidebarAbierto = false;
    }
  }

  cerrarSesion(): void {
    this.menuUsuarioAbierto = false;
    this.authService.cerrarSesion();
  }

  obtenerIniciales(nombre: string): string {
    return nombre
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((fragment) => fragment.charAt(0).toUpperCase())
      .join('');
  }

  @HostListener('document:click')
  cerrarMenuUsuario(): void {
    this.menuUsuarioAbierto = false;
  }

  @HostListener('window:resize')
  alCambiarTamanoVentana(): void {
    const eraMovil = this.viewportMovil;
    this.actualizarEstadoViewport();

    if (this.viewportMovil && !eraMovil) {
      this.sidebarAbierto = false;
    }

    if (!this.viewportMovil && eraMovil) {
      this.sidebarAbierto = true;
    }
  }

  private actualizarEtiquetaSeccion(): void {
    let currentRoute: ActivatedRoute | null = this.activatedRoute;

    while (currentRoute?.firstChild) {
      currentRoute = currentRoute.firstChild;
    }

    this.etiquetaSeccion = currentRoute?.snapshot.data['sectionLabel'] ?? 'Board';
  }

  private actualizarEstadoViewport(): void {
    this.viewportMovil = window.innerWidth <= 960;
  }
}

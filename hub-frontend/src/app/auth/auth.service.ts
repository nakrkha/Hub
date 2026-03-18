import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, timeout } from 'rxjs';

import { environment } from '../../environments/environment';
import { User } from '../models/user.model';

interface AuthResponse {
  token: string;
  user: User;
}

interface LoginPayload {
  identifier: string;
  password: string;
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

interface UpdateUserPayload {
  name: string;
  email: string;
  password?: string;
}

interface UpdateUserResponse {
  user: User;
  token?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authUrl = `${environment.apiUrl}/auth`;
  private readonly usersUrl = `${environment.apiUrl}/users`;
  private readonly tokenStorageKey = 'hub_token';
  private readonly currentUserSubject = new BehaviorSubject<User | null>(
    this.obtenerUsuarioDesdeToken()
  );

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  obtenerUsuarioActual(): Observable<User | null> {
    return this.currentUserSubject.asObservable();
  }

  obtenerUsuarioActualSnapshot(): User | null {
    return this.currentUserSubject.value;
  }

  iniciarSesion(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.authUrl}/login`, payload)
      .pipe(tap(({ token }) => this.guardarSesion(token)));
  }

  registrarUsuario(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.authUrl}/register`, payload)
      .pipe(tap(({ token }) => this.guardarSesion(token)));
  }

  listarUsuarios(): Observable<User[]> {
    return this.http.get<User[]>(this.usersUrl).pipe(timeout(5000));
  }

  crearUsuario(payload: RegisterPayload): Observable<User> {
    return this.http.post<User>(this.usersUrl, payload).pipe(timeout(5000));
  }

  actualizarUsuario(userId: number, payload: UpdateUserPayload): Observable<UpdateUserResponse> {
    return this.http.put<UpdateUserResponse>(`${this.usersUrl}/${userId}`, payload).pipe(
      timeout(5000),
      tap((response) => {
        if (response.token) {
          this.guardarSesion(response.token);
        }
      })
    );
  }

  eliminarUsuario(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.usersUrl}/${userId}`).pipe(timeout(5000));
  }

  obtenerToken(): string | null {
    return localStorage.getItem(this.tokenStorageKey);
  }

  estaAutenticado(): boolean {
    const token = this.obtenerToken();

    if (!token) {
      return false;
    }

    const payload = this.decodificarToken(token);
    const tokenExpirado = !payload?.['exp'] || payload['exp'] * 1000 <= Date.now();

    if (tokenExpirado) {
      this.cerrarSesion(false);
      return false;
    }

    return true;
  }

  cerrarSesion(redirigir = true): void {
    localStorage.removeItem(this.tokenStorageKey);
    this.currentUserSubject.next(null);

    if (redirigir) {
      this.router.navigate(['/login']);
    }
  }

  private guardarSesion(token: string): void {
    localStorage.setItem(this.tokenStorageKey, token);
    this.currentUserSubject.next(this.obtenerUsuarioDesdeToken());
  }

  private obtenerUsuarioDesdeToken(): User | null {
    const token = localStorage.getItem(this.tokenStorageKey);

    if (!token) {
      return null;
    }

    const payload = this.decodificarToken(token);

    if (!payload?.['sub'] || !payload?.['name'] || !payload?.['email']) {
      return null;
    }

    return {
      id: Number(payload['sub']),
      name: String(payload['name']),
      email: String(payload['email']),
      createdAt: String(payload['createdAt'] ?? new Date().toISOString()),
    };
  }

  private decodificarToken(token: string): Record<string, any> | null {
    try {
      const tokenPayload = token.split('.')[1];
      const base64 = tokenPayload.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map((character) => `%${`00${character.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join('')
      );

      return JSON.parse(json) as Record<string, any>;
    } catch {
      return null;
    }
  }
}

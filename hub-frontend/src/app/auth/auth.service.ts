import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, of, tap, timeout } from 'rxjs';

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
  private readonly demoUsersStorageKey = 'hub_demo_users';
  private readonly authBypass = environment.authBypass;
  private readonly demoCurrentUser: User = {
    id: 1,
    name: 'noha',
    email: 'noha@hub.local',
    createdAt: '2026-03-18T00:00:00.000Z',
  };
  private readonly currentUserSubject = new BehaviorSubject<User | null>(this.obtenerSesionInicial());

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
    if (this.authBypass) {
      const user = this.obtenerUsuarioDemo(payload.identifier);
      this.currentUserSubject.next(user);
      return of({
        token: 'demo-session',
        user,
      });
    }

    return this.http
      .post<AuthResponse>(`${this.authUrl}/login`, payload)
      .pipe(tap(({ token }) => this.guardarSesion(token)));
  }

  registrarUsuario(payload: RegisterPayload): Observable<AuthResponse> {
    if (this.authBypass) {
      const user = this.crearUsuarioDemo(payload);
      this.currentUserSubject.next(user);
      return of({
        token: 'demo-session',
        user,
      });
    }

    return this.http
      .post<AuthResponse>(`${this.authUrl}/register`, payload)
      .pipe(tap(({ token }) => this.guardarSesion(token)));
  }

  listarUsuarios(): Observable<User[]> {
    if (this.authBypass) {
      return of(this.obtenerUsuariosDemo());
    }

    return this.http.get<User[]>(this.usersUrl).pipe(timeout(5000));
  }

  crearUsuario(payload: RegisterPayload): Observable<User> {
    if (this.authBypass) {
      return of(this.crearUsuarioDemo(payload));
    }

    return this.http.post<User>(this.usersUrl, payload).pipe(timeout(5000));
  }

  actualizarUsuario(userId: number, payload: UpdateUserPayload): Observable<UpdateUserResponse> {
    if (this.authBypass) {
      const users = this.obtenerUsuariosDemo();
      const userIndex = users.findIndex((user) => user.id === userId);

      if (userIndex === -1) {
        return of({ user: this.demoCurrentUser });
      }

      const updatedUser: User = {
        ...users[userIndex],
        name: payload.name,
        email: payload.email,
      };

      users[userIndex] = updatedUser;
      this.guardarUsuariosDemo(users);

      if (this.currentUserSubject.value?.id === userId) {
        this.currentUserSubject.next(updatedUser);
      }

      return of({ user: updatedUser });
    }

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
    if (this.authBypass) {
      const users = this.obtenerUsuariosDemo().filter((user) => user.id !== userId);
      this.guardarUsuariosDemo(users);
      return of(void 0);
    }

    return this.http.delete<void>(`${this.usersUrl}/${userId}`).pipe(timeout(5000));
  }

  obtenerToken(): string | null {
    if (this.authBypass) {
      return null;
    }

    return localStorage.getItem(this.tokenStorageKey);
  }

  estaAutenticado(): boolean {
    if (this.authBypass) {
      return true;
    }

    const token = this.obtenerToken();

    if (!token) {
      return false;
    }

    const payload = this.decodificarToken(token);
    const tokenExpirado = !payload?.['exp'] || Number(payload['exp']) * 1000 <= Date.now();

    if (tokenExpirado) {
      this.cerrarSesion(false);
      return false;
    }

    return true;
  }

  cerrarSesion(redirigir = true): void {
    if (this.authBypass) {
      this.currentUserSubject.next(this.obtenerUsuarioDemo());

      if (redirigir) {
        this.router.navigate(['/dashboard']);
      }

      return;
    }

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

  private obtenerSesionInicial(): User | null {
    if (this.authBypass) {
      return this.obtenerUsuarioDemo();
    }

    return this.obtenerUsuarioDesdeToken();
  }

  private obtenerUsuarioDemo(identifier?: string): User {
    const normalizedIdentifier = String(identifier ?? '').trim().toLowerCase();
    const users = this.obtenerUsuariosDemo();

    return (
      users.find(
        (user) =>
          user.name.toLowerCase() === normalizedIdentifier ||
          user.email.toLowerCase() === normalizedIdentifier
      ) ?? users[0] ?? this.demoCurrentUser
    );
  }

  private obtenerUsuariosDemo(): User[] {
    try {
      const rawUsers = localStorage.getItem(this.demoUsersStorageKey);

      if (!rawUsers) {
        const defaultUsers = [this.demoCurrentUser];
        this.guardarUsuariosDemo(defaultUsers);
        return defaultUsers;
      }

      const users = JSON.parse(rawUsers) as User[];
      return users.length ? users : [this.demoCurrentUser];
    } catch {
      return [this.demoCurrentUser];
    }
  }

  private guardarUsuariosDemo(users: User[]): void {
    localStorage.setItem(this.demoUsersStorageKey, JSON.stringify(users));
  }

  private crearUsuarioDemo(payload: RegisterPayload): User {
    const users = this.obtenerUsuariosDemo();
    const newUser: User = {
      id: users.length ? Math.max(...users.map((user) => user.id)) + 1 : 1,
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    };

    this.guardarUsuariosDemo([newUser, ...users]);
    return newUser;
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

  private decodificarToken(token: string): Record<string, unknown> | null {
    try {
      const tokenPayload = token.split('.')[1];
      const base64 = tokenPayload.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(base64)
          .split('')
          .map((character) => `%${`00${character.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join('')
      );

      return JSON.parse(json) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

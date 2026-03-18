import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  enviandoFormulario = false;
  mensajeError = '';

  readonly loginForm = this.formBuilder.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  ngOnInit(): void {
    if (this.authService.estaAutenticado()) {
      this.router.navigate(['/dashboard']);
    }
  }

  enviarFormulario(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.enviandoFormulario = true;
    this.mensajeError = '';

    const { identifier, password } = this.loginForm.getRawValue();

    this.authService
      .iniciarSesion({
        identifier: identifier ?? '',
        password: password ?? '',
      })
      .pipe(finalize(() => (this.enviandoFormulario = false)))
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: (error) => {
          this.mensajeError = error.error?.message ?? 'No se pudo iniciar sesión.';
        },
      });
  }
}

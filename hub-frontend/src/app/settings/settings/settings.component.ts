import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { Project, ProjectPayload } from '../../models/project.model';
import { User } from '../../models/user.model';
import { ProjectService } from '../../services/project.service';

type ProjectDraft = {
  nombre: string;
  descripcion: string;
  url: string;
  imagen: string;
};

type UserDraft = {
  name: string;
  email: string;
  password: string;
};

type ToolsView = 'inicio' | 'proyectos' | 'cuentas';

@Component({
  selector: 'app-settings',
  standalone: false,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly defaultProjectImage = '/images/noakr home.png';
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly projectService = inject(ProjectService);

  usuarios: User[] = [];
  proyectos: Project[] = [];
  projectDrafts: Record<number, ProjectDraft> = {};
  userDrafts: Record<number, UserDraft> = {};
  usuarioActualId = 0;
  vistaActiva: ToolsView = 'inicio';
  cargandoUsuarios = true;
  cargandoProyectos = true;
  guardandoUsuario = false;
  guardandoNuevoProyecto = false;
  savingProjectIds: Record<number, boolean> = {};
  deletingProjectIds: Record<number, boolean> = {};
  savingUserIds: Record<number, boolean> = {};
  deletingUserIds: Record<number, boolean> = {};
  projectImageLoading: Record<number, boolean> = {};
  projectImageNames: Record<number, string> = {};
  mensajeError = '';
  mensajeOk = '';
  nombreArchivoPortada = '';
  cargandoPortada = false;

  readonly userForm = this.formBuilder.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  readonly projectForm = this.formBuilder.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    url: ['', [Validators.required]],
    imagen: [this.defaultProjectImage, [Validators.required]],
  });

  ngOnInit(): void {
    this.usuarioActualId = this.authService.obtenerUsuarioActualSnapshot()?.id ?? 0;
    this.cargarUsuarios();
    this.cargarProyectos();
  }

  abrirVista(vista: Exclude<ToolsView, 'inicio'>): void {
    this.vistaActiva = vista;
  }

  volverAInicio(): void {
    this.vistaActiva = 'inicio';
  }

  async manejarPortada(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      this.restablecerPortada();
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.mensajeError = 'La portada debe ser un archivo de imagen.';
      this.mensajeOk = '';
      input.value = '';
      return;
    }

    this.cargandoPortada = true;
    this.nombreArchivoPortada = file.name;
    this.mensajeError = '';

    try {
      const imagen = await this.leerArchivoComoDataUrl(file);
      this.projectForm.patchValue({ imagen });
    } catch {
      this.nombreArchivoPortada = '';
      this.projectForm.patchValue({ imagen: this.defaultProjectImage });
      this.mensajeError = 'No se pudo cargar la imagen seleccionada.';
    } finally {
      this.cargandoPortada = false;
    }
  }

  async manejarPortadaProyecto(projectId: number, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.mensajeError = 'La portada debe ser un archivo de imagen.';
      this.mensajeOk = '';
      input.value = '';
      return;
    }

    this.projectImageLoading[projectId] = true;
    this.projectImageNames[projectId] = file.name;
    this.mensajeError = '';

    try {
      const imagen = await this.leerArchivoComoDataUrl(file);
      this.projectDrafts[projectId] = {
        ...this.projectDrafts[projectId],
        imagen,
      };
    } catch {
      this.projectImageNames[projectId] = '';
      this.mensajeError = 'No se pudo cargar la nueva imagen del proyecto.';
    } finally {
      this.projectImageLoading[projectId] = false;
    }
  }

  crearProyecto(): void {
    if (this.projectForm.invalid || this.cargandoPortada) {
      this.projectForm.markAllAsTouched();
      return;
    }

    this.guardandoNuevoProyecto = true;
    this.limpiarMensajes();

    const payload: ProjectPayload = {
      nombre: (this.projectForm.value.nombre ?? '').trim(),
      descripcion: (this.projectForm.value.descripcion ?? '').trim(),
      url: (this.projectForm.value.url ?? '').trim(),
      imagen: this.projectForm.value.imagen || this.defaultProjectImage,
    };

    this.projectService
      .crearProyecto(payload)
      .pipe(finalize(() => (this.guardandoNuevoProyecto = false)))
      .subscribe({
        next: (project) => {
          this.proyectos = this.ordenarProyectos([project, ...this.proyectos]);
          this.projectDrafts[project.id] = this.crearBorradorProyecto(project);
          this.projectForm.reset({
            nombre: '',
            descripcion: '',
            url: '',
            imagen: this.defaultProjectImage,
          });
          this.nombreArchivoPortada = '';
          this.mensajeOk = `El proyecto ${project.nombre} ya aparece en el Board.`;
        },
        error: (error) => {
          this.mensajeError = error.error?.message ?? 'No se pudo crear el proyecto.';
        },
      });
  }

  guardarProyecto(proyecto: Project): void {
    const draft = this.projectDrafts[proyecto.id];
    const payload: ProjectPayload = {
      nombre: (draft?.nombre ?? '').trim(),
      descripcion: (draft?.descripcion ?? '').trim(),
      url: (draft?.url ?? '').trim(),
      imagen: draft?.imagen || proyecto.imagen || this.defaultProjectImage,
    };

    if (!payload.nombre) {
      this.mensajeError = 'El nombre del proyecto es obligatorio.';
      this.mensajeOk = '';
      return;
    }

    if (!payload.url) {
      this.mensajeError = `La URL para ${proyecto.nombre} es obligatoria.`;
      this.mensajeOk = '';
      return;
    }

    this.savingProjectIds[proyecto.id] = true;
    this.limpiarMensajes();

    this.projectService
      .actualizarProyecto(proyecto.id, payload)
      .pipe(finalize(() => (this.savingProjectIds[proyecto.id] = false)))
      .subscribe({
        next: (updatedProject) => {
          this.proyectos = this.ordenarProyectos(
            this.proyectos.map((item) => (item.id === updatedProject.id ? updatedProject : item))
          );
          this.projectDrafts[updatedProject.id] = this.crearBorradorProyecto(updatedProject);
          this.projectImageNames[updatedProject.id] = '';
          this.mensajeOk = `El proyecto ${updatedProject.nombre} se ha guardado correctamente.`;
        },
        error: (error) => {
          this.mensajeError = error.error?.message ?? 'No se pudo guardar el proyecto.';
        },
      });
  }

  eliminarProyecto(proyecto: Project): void {
    if (!window.confirm(`¿Quieres borrar el proyecto ${proyecto.nombre}?`)) {
      return;
    }

    this.deletingProjectIds[proyecto.id] = true;
    this.limpiarMensajes();

    this.projectService
      .eliminarProyecto(proyecto.id)
      .pipe(finalize(() => (this.deletingProjectIds[proyecto.id] = false)))
      .subscribe({
        next: () => {
          this.proyectos = this.proyectos.filter((item) => item.id !== proyecto.id);
          delete this.projectDrafts[proyecto.id];
          delete this.projectImageNames[proyecto.id];
          delete this.projectImageLoading[proyecto.id];
          this.mensajeOk = `El proyecto ${proyecto.nombre} se ha eliminado correctamente.`;
        },
        error: (error) => {
          this.mensajeError = error.error?.message ?? 'No se pudo eliminar el proyecto.';
        },
      });
  }

  crearUsuario(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.guardandoUsuario = true;
    this.limpiarMensajes();

    const { name, email, password } = this.userForm.getRawValue();

    this.authService
      .crearUsuario({
        name: name ?? '',
        email: email ?? '',
        password: password ?? '',
      })
      .pipe(finalize(() => (this.guardandoUsuario = false)))
      .subscribe({
        next: (user) => {
          this.usuarios = this.ordenarUsuarios([user, ...this.usuarios]);
          this.userDrafts[user.id] = this.crearBorradorUsuario(user);
          this.userForm.reset();
          this.mensajeOk = 'La cuenta se ha creado correctamente.';
        },
        error: (error) => {
          this.mensajeError = error.error?.message ?? 'No se pudo crear la cuenta.';
        },
      });
  }

  guardarUsuario(usuario: User): void {
    const draft = this.userDrafts[usuario.id];
    const payload = {
      name: (draft?.name ?? '').trim(),
      email: (draft?.email ?? '').trim(),
      password: (draft?.password ?? '').trim(),
    };

    if (!payload.name || !payload.email) {
      this.mensajeError = 'Nombre y email son obligatorios.';
      this.mensajeOk = '';
      return;
    }

    this.savingUserIds[usuario.id] = true;
    this.limpiarMensajes();

    this.authService
      .actualizarUsuario(usuario.id, payload)
      .pipe(finalize(() => (this.savingUserIds[usuario.id] = false)))
      .subscribe({
        next: ({ user }) => {
          this.usuarios = this.ordenarUsuarios(
            this.usuarios.map((item) => (item.id === user.id ? user : item))
          );
          this.userDrafts[user.id] = this.crearBorradorUsuario(user);
          this.mensajeOk = `La cuenta ${user.name} se ha guardado correctamente.`;
        },
        error: (error) => {
          this.mensajeError = error.error?.message ?? 'No se pudo guardar la cuenta.';
        },
      });
  }

  eliminarUsuario(userId: number): void {
    if (!window.confirm('¿Quieres eliminar esta cuenta?')) {
      return;
    }

    this.deletingUserIds[userId] = true;
    this.limpiarMensajes();

    this.authService
      .eliminarUsuario(userId)
      .pipe(finalize(() => (this.deletingUserIds[userId] = false)))
      .subscribe({
        next: () => {
          this.usuarios = this.usuarios.filter((user) => user.id !== userId);
          delete this.userDrafts[userId];
          this.mensajeOk = 'La cuenta se ha eliminado correctamente.';
        },
        error: (error) => {
          this.mensajeError = error.error?.message ?? 'No se pudo eliminar la cuenta.';
        },
      });
  }

  actualizarBorradorProyecto(
    projectId: number,
    field: keyof ProjectDraft,
    value: string
  ): void {
    this.projectDrafts[projectId] = {
      ...this.projectDrafts[projectId],
      [field]: value,
    };
  }

  actualizarBorradorUsuario(userId: number, field: keyof UserDraft, value: string): void {
    this.userDrafts[userId] = {
      ...this.userDrafts[userId],
      [field]: value,
    };
  }

  private cargarUsuarios(): void {
    this.cargandoUsuarios = true;
    this.mensajeError = '';

    this.authService
      .listarUsuarios()
      .pipe(finalize(() => (this.cargandoUsuarios = false)))
      .subscribe({
        next: (users) => {
          this.usuarios = this.ordenarUsuarios(users);
          this.userDrafts = this.usuarios.reduce<Record<number, UserDraft>>((accumulator, user) => {
            accumulator[user.id] = this.crearBorradorUsuario(user);
            return accumulator;
          }, {});
        },
        error: (error) => {
          this.mensajeError =
            error.error?.message ?? 'No se pudieron cargar las cuentas registradas.';
        },
      });
  }

  private cargarProyectos(): void {
    this.cargandoProyectos = true;

    this.projectService
      .obtenerProyectos()
      .pipe(finalize(() => (this.cargandoProyectos = false)))
      .subscribe({
        next: (projects) => {
          this.proyectos = this.ordenarProyectos(projects);
          this.projectDrafts = this.proyectos.reduce<Record<number, ProjectDraft>>(
            (accumulator, project) => {
              accumulator[project.id] = this.crearBorradorProyecto(project);
              return accumulator;
            },
            {}
          );
        },
        error: () => {
          this.mensajeError = 'No se pudieron cargar los proyectos.';
        },
      });
  }

  private limpiarMensajes(): void {
    this.mensajeError = '';
    this.mensajeOk = '';
  }

  private restablecerPortada(): void {
    this.nombreArchivoPortada = '';
    this.projectForm.patchValue({ imagen: this.defaultProjectImage });
  }

  private ordenarProyectos(projects: Project[]): Project[] {
    return [...projects].sort((left, right) => right.id - left.id);
  }

  private ordenarUsuarios(users: User[]): User[] {
    return [...users].sort((left, right) => right.id - left.id);
  }

  private crearBorradorProyecto(project: Project): ProjectDraft {
    return {
      nombre: project.nombre,
      descripcion: project.descripcion,
      url: project.url,
      imagen: project.imagen || this.defaultProjectImage,
    };
  }

  private crearBorradorUsuario(user: User): UserDraft {
    return {
      name: user.name,
      email: user.email,
      password: '',
    };
  }

  private leerArchivoComoDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Formato de archivo no válido.'));
      };

      reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      reader.readAsDataURL(file);
    });
  }
}

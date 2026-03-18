import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './auth/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { DashboardComponent } from './dashboard/dashboard/dashboard.component';
import { WorkspaceLayoutComponent } from './layout/workspace-layout/workspace-layout.component';
import { SettingsComponent } from './settings/settings/settings.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: '',
    component: WorkspaceLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent, data: { sectionLabel: 'Board' } },
      {
        path: 'herramientas',
        component: SettingsComponent,
        data: { sectionLabel: 'Herramientas' },
      },
      { path: 'settings', pathMatch: 'full', redirectTo: 'herramientas' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}

import { Component, Input } from '@angular/core';

import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-card',
  standalone: false,
  templateUrl: './project-card.component.html',
  styleUrl: './project-card.component.scss',
})
export class ProjectCardComponent {
  @Input({ required: true }) proyecto!: Project;

  abrirProyecto(): void {
    const targetUrl = this.proyecto.url.startsWith('http')
      ? this.proyecto.url
      : `https://${this.proyecto.url}`;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }
}

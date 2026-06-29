import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

import { KnowledgeBreadcrumbService } from '../../../core/services/knowledge-breadcrumb';

@Component({
  selector: 'app-knowledge-breadcrumb',
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge-breadcrumb.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './knowledge-breadcrumb.scss',
})
export class KnowledgeBreadcrumb {
  readonly breadcrumbService = inject(KnowledgeBreadcrumbService);
}

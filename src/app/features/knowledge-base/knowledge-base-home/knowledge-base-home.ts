import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface KnowledgeFolder {
  id: string;
  name: string;
  description?: string;
}

@Component({
  selector: 'app-knowledge-base-home',
  imports: [CommonModule, RouterLink],
  templateUrl: './knowledge-base-home.html',
  styleUrl: './knowledge-base-home.scss',
})
export class KnowledgeBaseHome {
  folders: KnowledgeFolder[] = [
    { id: 'repsol-campanhas', name: 'Repsol - Campanhas & Formulários' },
    { id: 'galp-campanhas', name: 'Galp - Campanhas & Formulários' },
    { id: 'yes-energy-campanhas', name: 'Yes Energy - Campanhas' },
    { id: 'iberdrola-campanhas', name: 'Iberdrola - Campanhas' },
    { id: 'meo-campanhas', name: 'Meo - Campanhas & Formulários' },
  ];
}
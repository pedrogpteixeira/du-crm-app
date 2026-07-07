import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { roleIncludesGuard } from './core/guards/role-includes-guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/signup/signup').then((m) => m.Signup),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/home-layout/home-layout').then((m) => m.HomeLayout),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'users',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/users/users').then((m) => m.Users),
      },
      {
        path: 'teams',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/teams/teams').then((m) => m.Teams),
      },
      {
        path: 'teams/:id',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/teams/team-detail/team-detail').then(
            (m) => m.TeamDetail,
          ),
      },
      {
        path: 'users/:id',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/users/user-detail/user-detail').then((m) => m.UserDetail),
      },
      {
        path: 'contracts/repsol',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/contracts/repsol-contracts/repsol-contracts').then(
            (m) => m.RepsolContracts,
          ),
      },
      {
        path: 'contracts/repsol/create',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/contracts/repsol-contract-create/repsol-contract-create').then(
            (m) => m.RepsolContractCreate,
          ),
      },
      {
        path: 'contracts/repsol/:id',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/contracts/repsol-contract-detail/repsol-contract-detail').then(
            (m) => m.RepsolContractDetail,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile').then((m) => m.Profile),
      },
      {
        path: 'knowledge-base',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/knowledge-base/knowledge-base-home/knowledge-base-home')
            .then((m) => m.KnowledgeBaseHome),
      },
      {
        path: 'knowledge-base/folders/:id',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/knowledge-base/knowledge-folder/knowledge-folder')
            .then((m) => m.KnowledgeFolder),
      },
      {
        path: 'knowledge-base/articles/:id',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/knowledge-base/knowledge-article/knowledge-article')
            .then((m) => m.KnowledgeArticle),
      },
      {
        path: 'knowledge-base/campaigns/:companyId',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/knowledge-base/knowledge-campaigns/knowledge-campaigns').then(
            (m) => m.KnowledgeCampaigns,
          ),
      },
      {
        path: 'simulator/proposal-preview',
        loadComponent: () =>
          import('./features/simulator/proposal-preview/proposal-preview').then(
            (m) => m.ProposalPreview,
          ),
      },
      {
        path: 'admin/omie-averages',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/admin/omie-averages/omie-averages').then(
            (m) => m.OmieAverages,
          ),
      },
      {
        path: 'tariffs/create',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/simulator/tariff-create/tariff-create').then(
            (m) => m.TariffCreate,
          ),
      },
      {
        path: 'tariffs/edit',
        canActivate: [roleIncludesGuard],
        data: {
          allowedRoles: ['Super Admin'],
        },
        loadComponent: () =>
          import('./features/simulator/tariff-edit/tariff-edit').then(
            (m) => m.TariffEdit,
          ),
      },
      {
        path: 'simulator',
        loadComponent: () =>
          import('./features/simulator/simulator').then(
            (m) => m.Simulator,
          ),
      },
      {
        path: 'invoice-compare',
        loadComponent: () =>
          import('./features/simulator/invoice-compare/invoice-compare').then(
            (m) => m.InvoiceCompare,
          ),
      },
      {
        path: 'preferences',
        loadComponent: () =>
          import('./features/preferences/preferences').then(
            (m) => m.Preferences,
          ),
      },
    ],
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
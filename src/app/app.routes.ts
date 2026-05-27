import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'signup',
    loadComponent: () => import('./features/auth/signup/signup').then((m) => m.Signup),
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./layout/home-layout/home-layout').then((m) => m.HomeLayout),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/dashboard/dashboard').then((m) => m.Dashboard),
      },
    ],
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
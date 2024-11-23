import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RutinasPage } from './rutinas.page';
import { EjerciciosPage } from '../ejercicios/ejercicios.page';

const routes: Routes = [
  {
    path: '',
    component: RutinasPage
  },
  {
    path: 'ejercicios',
    loadChildren: () => import('../ejercicios/ejercicios.module').then(m => m.EjerciciosPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RutinasPageRoutingModule {}

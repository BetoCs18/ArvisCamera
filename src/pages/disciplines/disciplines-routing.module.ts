import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DisciplinesPage } from './disciplines.page';
import { RutinasPage } from '../rutinas/rutinas.page';

const routes: Routes = [
  {
    path: '',
    component: DisciplinesPage
  },
  {
    path: 'rutinas',
    loadChildren: () => import('../rutinas/rutinas.module').then(m => m.RutinasPageModule)
  },
  {
    path: 'rutinas/:routine',
    component: RutinasPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DisciplinesPageRoutingModule {}

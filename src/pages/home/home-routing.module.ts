import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePage } from './home.page';

const routes: Routes = [
  {
    path: '',
    component: HomePage,
    children: [
      {
        path: 'inicio',
        loadChildren: () => import('../inicio/inicio.module').then(m => m.InicioPageModule)
      },
      {
        path: 'streaming',
        loadChildren: () => import('../streaming-ffmpeg/streaming-ffmpeg.module').then(m => m.StreamingFfmpegPageModule)
      },
      {
        path: 'disciplines',
        loadChildren: () => import('../disciplines/disciplines.module').then(m => m.DisciplinesPageModule)
      },
      {
        path: '',
        redirectTo: 'disciplines',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HomePageRoutingModule {}

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePage } from './home.page';

const routes: Routes = [
  {
    path: '',
    component: HomePage,
    children: [
      {
        path: 'streaming',
        loadChildren: () => import('../streaming-ffmpeg/streaming-ffmpeg.module').then(m => m.StreamingFfmpegPageModule)
      },
      {
        path: 'rutinas',
        loadChildren: () => import('../rutinas/rutinas.module').then(m => m.RutinasPageModule)
      },
      {
        path: '',
        redirectTo: 'streaming',
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

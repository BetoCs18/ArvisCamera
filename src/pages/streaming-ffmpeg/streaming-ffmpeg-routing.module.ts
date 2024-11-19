import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StreamingFfmpegPage } from './streaming-ffmpeg.page';

const routes: Routes = [
  {
    path: '',
    component: StreamingFfmpegPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class StreamingFfmpegPageRoutingModule {}

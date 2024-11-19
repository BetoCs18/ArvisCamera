import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { StreamingFfmpegPageRoutingModule } from './streaming-ffmpeg-routing.module';
import { StreamingFfmpegPage } from './streaming-ffmpeg.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    StreamingFfmpegPageRoutingModule
  ],
  declarations: [StreamingFfmpegPage]
})
export class StreamingFfmpegPageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DisciplinesPageRoutingModule } from './disciplines-routing.module';

import { DisciplinesPage } from './disciplines.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DisciplinesPageRoutingModule
  ],
  declarations: [DisciplinesPage]
})
export class DisciplinesPageModule {}

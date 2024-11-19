import { Component } from '@angular/core';
import { addIcons } from 'ionicons';
import { library, playCircle, radio, search } from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {

  selectedOption: string = '';

  constructor() {
    addIcons({ library, playCircle, radio, search });
  }

  onOptionChange() {
    console.log('Opción seleccionada:', this.selectedOption);
  }
}

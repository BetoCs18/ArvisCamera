import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-rutinas',
  templateUrl: './rutinas.page.html',
  styleUrls: ['./rutinas.page.scss'],
})
export class RutinasPage {

  constructor() {}

  navigateTo(url: string): void {
    window.location.href = url;
  }

}

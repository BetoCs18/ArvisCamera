import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-rutinas',
  templateUrl: './rutinas.page.html',
  styleUrls: ['./rutinas.page.scss'],
})
export class RutinasPage implements OnInit {

  jsonData :any;
  routines:any;
  routine:any;

  constructor(private router: Router, private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.routine = params.get('routine');
    });
    this.getRoutines();
  }

  private getRoutines() {  
    this.http.get('assets/sports/sports.json').subscribe(
      data => {
        this.jsonData = data;
        if (this.jsonData[this.routine]) {
          this.routines = Object.entries(this.jsonData[this.routine].rutinas).map(
            ([level, details]: [string, any]) => {
              return {
                level,
                title: details.title,
                image: details.image,
                exercises: details.exercises
              };
            }
          );
          // console.log('Rutinas encontradas:', this.routines);
        } else {
          console.warn('Rutina no encontrada para:', this.routine);
        }
      },
      error => {
        console.error('Error al cargar el archivo JSON:', error);
      }
    );
  }
}

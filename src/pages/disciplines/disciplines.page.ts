import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-disciplines',
  templateUrl: './disciplines.page.html',
  styleUrls: ['./disciplines.page.scss'],
})
export class DisciplinesPage implements OnInit {

  jsonData :any;
  sports:any;

  constructor(private router: Router, private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.getSports();
  }

  navigateTo(tipo: string) {
    this.router.navigate(['rutinas', tipo], { relativeTo: this.route });

  }

  private getSports(){
    this.http.get('assets/sports/sports.json').subscribe(
      data => {
        this.jsonData = data;
        this.sports = Object.keys(this.jsonData).map(key => ({ name: key, datos: this.jsonData[key] }));
        console.log(this.sports);
      },
      error => {
        console.error('Error al cargar el archivo JSON:', error);
      }
    );
  }

}

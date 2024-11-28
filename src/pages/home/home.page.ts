import { Component, OnInit } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

import { addIcons } from 'ionicons';
import { library, playCircle, radio, search } from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  constructor() {
    addIcons({ library, playCircle, radio, search });
  }

  async ngOnInit() {
    await this.createCacheFolder();
    await this.createEmptyImage();
  }

  async createCacheFolder() {
    try {
      await Filesystem.mkdir({
        path: 'live', // Nombre de la carpeta que quieres crear
        directory: Directory.Cache, // Ubicación en la carpeta de caché de la app
        recursive: true,
      });
      console.log('Carpeta creada en caché');
    } catch (error) {
      console.error('Error al crear la carpeta', error);
    }
  }

  async createEmptyImage(){
    try{
      const fileExists = await this.checkIfFileExists('live/stream.jpg');

      if(!fileExists){
        const emptyImage = '';
        await Filesystem.writeFile({
          path: 'live/stream.jpeg',
          data: emptyImage,
          directory: Directory.Cache
        });
        console.log('Archivo creado exitosamente');
      }else{
        console.warn('El archivo ya existe');
      }
    }catch (error) {
      console.error('Error al crear el archivo: ', error);
    }
  }

  async checkIfFileExists(fileName: string): Promise<boolean> {
    try {
      await Filesystem.stat({
        path: fileName,
        directory: Directory.Cache,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

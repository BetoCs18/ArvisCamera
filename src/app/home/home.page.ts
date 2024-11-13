import { Component } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Capacitor, Plugins } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Platform } from '@ionic/angular';

interface FFmpegStreamPlugin {
  startStream(options: { rtspUrl: string }): Promise<{ httpUrl: string }>;
}
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  rtspUrl: string = '';
  httpStreamUrl: string | null = null;
  dynamicImageUrl: SafeUrl | null = null;
  intervalId: any;
  lastImageData: string | null = null;

  constructor(public sanitizer: DomSanitizer, private platform: Platform) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.createCacheFolder();
    });
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

  async startStream() {
    this.startImageRefresh();
    try {
      const FFmpegStream = Capacitor.Plugins['FFmpegStream'] as unknown as FFmpegStreamPlugin;
      const result = await FFmpegStream.startStream({ rtspUrl: this.rtspUrl });
      this.httpStreamUrl = result.httpUrl;
    } catch (error) {
      console.error('Error al iniciar la transmisión:', error);
    }
  }

  async getImageUrl(){
    try{
      const result = await Filesystem.readFile({
        path: 'live/stream.jpg', // Ruta relativa dentro del directorio de caché
        directory: Directory.Cache,
      });
      if (result.data) {
        if (typeof result.data === 'string') {
          this.dynamicImageUrl = this.sanitizer.bypassSecurityTrustUrl(`data:image/jpeg;base64,${result.data}`);
        } else if (result.data instanceof Blob) {
          const blobUrl = URL.createObjectURL(result.data);
          this.dynamicImageUrl = this.sanitizer.bypassSecurityTrustUrl(blobUrl);
        }
      } else {
        console.warn("La imagen está vacía o no se pudo leer.");
      }
      //console.log(this.dynamicImageUrl);
    } catch (error) {
      console.error('Error al leer el archivo: ', error);
    }
  }

  startImageRefresh(){
    console.error("Inicia start image ref");
    this.getImageUrl();
    this.intervalId = setInterval(() => {
      this.getImageUrl();
    }, 1000/30);
  }

  stopImageRefresh(){
    if (this.intervalId){
      clearInterval(this.intervalId);
    }
  }

  ngOnDestroy(){
    this.stopImageRefresh();
  }
}

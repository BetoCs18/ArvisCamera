import { Component, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { FilesetResolver, PoseLandmarker, DrawingUtils, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Platform } from '@ionic/angular';
import { Capacitor, Plugins } from '@capacitor/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
interface FFmpegStreamPlugin {
  startStream(options: { rtspUrl: string }): Promise<{ httpUrl: string }>;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements AfterViewInit {
  @ViewChild('outputCanvas', { static: true }) outputCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('inputImage', {static: true}) inputImage!: ElementRef<HTMLImageElement>;

  private canvasCtx!: CanvasRenderingContext2D;
  rtspUrl: string = '';
  httpStreamUrl: string | null = null;
  poseLandmarker!: PoseLandmarker;
  runnungMode = "IMAGE";
  drawingUtils!: DrawingUtils;
  dynamicImageUrl: SafeUrl | null = null;
  intervalId: any;
  lastImageData: string | null = null;

  constructor(public sanitizer: DomSanitizer, private platform: Platform) {}

  ngAfterViewInit() {
    this.outputCanvas.nativeElement.style.left = '0px';
    this.outputCanvas.nativeElement.style.top = '0px';
    this.initializeApp();
    this.initializePoseDetection();
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.createCacheFolder();
    });
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

  private async initializePoseDetection() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(
      vision,
      {
        baseOptions: {
          modelAssetPath: "assets/mediapipe/models/pose_landmarker_lite.task",
          delegate: 'GPU'
        },
        numPoses: 1
      }
    )
  }

  private async getImageUrl(): Promise<HTMLImageElement | null>{
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
        const imageElement = new Image();
        imageElement.src = `data:image/jpeg;base64,${result.data}`;
        await new Promise<void>((resolve) => {
          imageElement.onload = () => resolve();
        });
        return imageElement;
      } else {
        console.warn("La imagen está vacía o no se pudo leer.");
        return null;
      }
      //console.log(this.dynamicImageUrl);
    } catch (error) {
      console.error('Error al leer el archivo: ', error);
      return null;
    }
  }

  /*startImageRefresh() {
    this.intervalId = setInterval(() => {
      const image = this.getImageUrl();
      if(image == true){

      }
    }, 1000/30);
  }*/

  private async startImageRefresh() {
    // Ejecuta el refresco de imagen a intervalos
    setInterval(async () => {
      const imageElement = await this.getImageUrl();
      if (imageElement) {
        const poseLandmarkerResult = this.poseLandmarker.detect(imageElement);
        this.onResults(poseLandmarkerResult);
      }
    }, 1000 / 20); // Frecuencia de actualización ajustable
  }

  private async loadImageFromCache(): Promise<HTMLImageElement | null> {
    try {
      const result = await Filesystem.readFile({
        path: 'live/stream.jpg', // Ruta de la imagen en caché
        directory: Directory.Cache
      });

      // Crear una imagen HTML y cargar la base64 en ella
      const imageElement = new Image();
      imageElement.src = `data:image/jpeg;base64,${result.data}`;

      // Espera a que la imagen se cargue
      await new Promise<void>((resolve) => {
        imageElement.onload = () => resolve();
      });

      return imageElement;
    } catch (error) {
      console.error('Error al leer el archivo:', error);
      return null;
    }
  }

  private onResults(results: PoseLandmarkerResult) {
    const canvas = this.outputCanvas.nativeElement;
    const context = canvas.getContext('2d');
    if (context) {
      this.canvasCtx = context;
      this.drawingUtils = new DrawingUtils(this.canvasCtx);
    }else{
      console.error('Error: no se pudo obtener el contexto del canvas');
    }
    if(!this.canvasCtx) return;
    this.outputCanvas.nativeElement.style.width = this.inputImage.nativeElement.width+"px";
    this.outputCanvas.nativeElement.style.height = this.inputImage.nativeElement.height+"px";
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.outputCanvas.nativeElement.width, this.outputCanvas.nativeElement.height);

    for (const landmark of results.landmarks) {
      this.drawingUtils.drawLandmarks(landmark, {
        radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1)
      });
      this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
    }
    // Dibuja la imagen en el canvas
    /*const imageElement = this.outputCanvas.nativeElement;
    this.canvasCtx.drawImage(
      imageElement,
      0,
      0,
      this.outputCanvas.nativeElement.width,
      this.outputCanvas.nativeElement.height
    );

    // Dibuja la pose sobre la imagen
    if (results.landmarks) {
      drawConnectors(this.canvasCtx, results.landmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
      drawLandmarks(this.canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });
    }*/

    this.canvasCtx.restore();
  }
}

import { Component, ElementRef, AfterViewInit, ViewChild, OnInit } from '@angular/core';
import { FilesetResolver, PoseLandmarker, DrawingUtils, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Platform } from '@ionic/angular';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import FFmpegStream from 'src/plugins/ffmpeg-stream.plugin';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, AfterViewInit {
  @ViewChild('contentDiv', { static: true }) contentDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('inputImage', {static: true}) inputImage!: ElementRef<HTMLImageElement>;

  outputCanvas!: HTMLCanvasElement;
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

  ngOnInit() {
      this.setImage();
  }

  ngAfterViewInit() {
    this.initializeApp();
    setTimeout(() => {
      this.initializePoseDetection();
    }, 500)
  }

  initializeApp() {
    this.platform.ready().then(() => {
      this.createCacheFolder();
    });
  }

  setImage(){
    const image = new Image();
    image.src = 'assets/images/Portada_Fondo_-_Camara.png';
    this.dynamicImageUrl = image.src;
  }

  printValues(){
    this.onImageLoad();
  }

  onImageLoad(){
    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.width = this.inputImage.nativeElement.offsetWidth;
    this.outputCanvas.height = this.inputImage.nativeElement.offsetHeight;
    this.outputCanvas.style.position = 'absolute';
    this.outputCanvas.style.left = '0';
    this.outputCanvas.style.top = '0';
    this.outputCanvas.style.zIndex = '3';
    this.outputCanvas.style.pointerEvents = 'none';
    this.contentDiv.nativeElement.appendChild(this.outputCanvas);
    const context = this.outputCanvas.getContext('2d');
    if (context) {
      this.canvasCtx = context;
      this.drawingUtils = new DrawingUtils(this.canvasCtx);
    } else {
      console.error('Error: no se pudo obtener el contexto del canvas');
    }
  }

  validateContext(): boolean{
    const gl = this.outputCanvas.getContext('webgl') || this.outputCanvas.getContext('experimental-webgl');
    console.log('WebGL Supported', !!gl);

    const gl2 = this.outputCanvas.getContext('webgl2');
    console.log('WebGl 2 Supported', !!gl2);

    if(!!gl && !!gl2){
      console.log(true);
      return true;
    }else{
      console.log(false);
      return false;
    }
  }

  async startStream() {
    this.startImageRefresh();
    try {
      const result = await FFmpegStream.startStream({ rtspUrl: this.rtspUrl });
      this.httpStreamUrl = result.httpUrl;
      console.log('Respuesta: ',this.httpStreamUrl);
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
    this.onImageLoad();
    console.log('Inicializa pose');
    const resultGPU = await this.createModelGPU();
    if (!resultGPU) {
      const resultCPU = await this.createModelCPU();
      console.error("Fallo en la inicialización del modelo en GPU");
      if (!resultCPU) {
        console.error("Fallo en la inicialización del modelo");
      }else{
        console.warn("Inicialización del modelo en CPU exitosa");
      }
    }else{
      console.log("Inicialización del modelo en GPU exitosa");
    }
    console.log("Termina inicializacion");
  }

  private async createModelGPU(): Promise<boolean>{
    try{
      const vision = await FilesetResolver.forVisionTasks(
        "assets/mediapipe/tasks-vision/0.10.18/wasm"
      );

      this.poseLandmarker = await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: "assets/mediapipe/models/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          numPoses: 1
        }
      )
      return true;
    }catch (error){
      console.error("Error al crear el modelo en GPU ", error);
      return false;
    }
  }

  private async createModelCPU(): Promise<boolean>{
    try{
      const vision = await FilesetResolver.forVisionTasks(
        "assets/mediapipe/tasks-vision/0.10.18/wasm"
      );

      this.poseLandmarker = await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: "assets/mediapipe/models/pose_landmarker_lite.task",
            delegate: "CPU"
          },
          numPoses: 1
        }
      )
      return true;
    }catch (error){
      console.error("Error al crear el modelo en CPU ", error);
      return false;
    }
  }

  private async getImageUrl(): Promise<HTMLImageElement | null>{
    try{
      const result = await Filesystem.readFile({
        path: 'live/stream.jpg', // Ruta relativa dentro del directorio de caché
        directory: Directory.Cache,
      });
      if (result.data) {
        const imageElement = new Image();
        imageElement.src = `data:image/jpeg;base64,${result.data}`;
        await new Promise<void>((resolve, reject) => {
          imageElement.onload = () => resolve();
          imageElement.onerror = (e) => reject(e);
        });
        return imageElement;
      } else {
        console.warn("La imagen está vacía o no se pudo leer.");
        return null;
      }
    } catch (error) {
      console.error('Error al leer el archivo: ', error);
      return null;
    }
  }

  private async startImageRefresh() {
    // Ejecuta el refresco de imagen a intervalos
    setInterval(async () => {
      const imageElement = await this.getImageUrl();
      if (imageElement) {
        this.dynamicImageUrl = this.sanitizer.bypassSecurityTrustUrl(`${imageElement.src}`);
        try{
          const poseLandmarkerResult = this.poseLandmarker.detect(imageElement);
          if (poseLandmarkerResult) {
            this.onResults(poseLandmarkerResult);
          }
        }catch (error){
          console.error("Error al detectar poses con mediapipe: ", error);
        }
      }
    }, 1000 / 20); // Frecuencia de actualización ajustable
  }

  private onResults(results: PoseLandmarkerResult) {
    if(!this.canvasCtx) return;
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

    for (const landmark of results.landmarks) {
      this.drawingUtils.drawLandmarks(landmark, {
        radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1)
      });
      this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
    }

    this.canvasCtx.restore();
  }
}

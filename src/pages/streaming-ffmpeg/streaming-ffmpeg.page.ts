import { Component, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { FilesetResolver, PoseLandmarker, DrawingUtils, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { IonButton, Platform } from '@ionic/angular';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import FFmpegStream from 'src/plugins/ffmpeg-stream.plugin';


@Component({
  selector: 'app-streaming-ffmpeg',
  templateUrl: './streaming-ffmpeg.page.html',
  styleUrls: ['./streaming-ffmpeg.page.scss'],
})
export class StreamingFfmpegPage implements AfterViewInit  {


  @ViewChild('contentDiv', { static: true }) contentDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('inputImage', {static: true}) inputImage!: ElementRef<HTMLImageElement>;

  outputCanvas!: HTMLCanvasElement;
  private resizeObserver: ResizeObserver | null = null;
  private canvasCtx!: CanvasRenderingContext2D;
  httpStreamUrl: string | null = null;
  poseLandmarker!: PoseLandmarker;
  drawingUtils!: DrawingUtils;
  dynamicImageUrl: SafeUrl | null = '../assets/Portada_Fondo_-_Camara.png';
  intervalId: any;
  lastImageData: string | null = null;
  rtspUrl: string = 'rtsp://192.168.1.18/1/h264major';
  startedStream: boolean = false;

  jsonData :any;
  selectedModel: any = null;
  errorsPose:any = 0;
  errorsPosePoints:any = '';
  statusPose:any = 'Estatus de la Postura';
  FooterColor:any = "primary";
  models:any;

  constructor(public sanitizer: DomSanitizer, private platform: Platform, private http: HttpClient) {}

  ngAfterViewInit() {
    this.initResizeObserver();
    this.getJsonModels();
  }

  initResizeObserver(){
    if (this.inputImage){
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries){
          const {width, height} = entry.contentRect;
          console.log(`Tamaño de la imagen: ${width}px x ${height}px`);
          this.onImageLoad();
        }
      });
      this.resizeObserver.observe(this.inputImage.nativeElement);
    }
  }

  onImageLoad(){
    if(!this.outputCanvas){
      console.log("Creando canvas");
      this.outputCanvas = document.createElement('canvas');
      this.outputCanvas.width = this.inputImage.nativeElement.offsetWidth;
      this.outputCanvas.height = this.inputImage.nativeElement.offsetHeight;
      this.outputCanvas.style.position = 'absolute';
      this.outputCanvas.style.left = '0';
      this.outputCanvas.style.top = '0';
      this.outputCanvas.style.zIndex = '3';
      this.outputCanvas.style.pointerEvents = 'none';
      this.contentDiv.nativeElement.appendChild(this.outputCanvas);
    }else{
      this.outputCanvas.width = this.inputImage.nativeElement.offsetWidth;
      this.outputCanvas.height = this.inputImage.nativeElement.offsetHeight;
    }
    console.log("Canvas creado");
    if(this.outputCanvas.height != 0){
      const context = this.outputCanvas.getContext('2d');
      if (context) {
        this.canvasCtx = context;
        this.drawingUtils = new DrawingUtils(this.canvasCtx);
        this.initializePoseDetection();
      } else {
        console.error('Error: no se pudo obtener el contexto del canvas');
      }
      this.resizeObserver?.disconnect();
    }
  }

  async startStream() {
    this.startImageRefresh();
    this.startedStream = true;
    try {
      const result = await FFmpegStream.startStream({ rtspUrl: this.rtspUrl });
      this.httpStreamUrl = result.httpUrl;
      console.log('Respuesta: ',this.httpStreamUrl);
    } catch (error) {
      console.error('Error al iniciar la transmisión:', error);
    }
  }

  async cancelStream() {
    console.log('Entro a stop stream');
    try{
      this.startedStream = false;
      await FFmpegStream.stopStream();
      this.stopImageRefresh();
      this.dynamicImageUrl = '/assets/Portada_Fondo_-_Camara.png';
      console.log('Transmisión detenida');
    }catch(error){
      console.error('Error al detener la transmisión: ', error);
    }
  }

  private async initializePoseDetection() {
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
          runningMode: 'IMAGE',
          numPoses: 1,
          minPoseDetectionConfidence: 0.6,
          minPosePresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
          outputSegmentationMasks: false
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
          runningMode: 'IMAGE',
          numPoses: 1,
          minPoseDetectionConfidence: 0.6,
          minPosePresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
          outputSegmentationMasks: false
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
    this.getJsonModels();
    this.intervalId = setInterval(async () => {
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

  stopImageRefresh(){
    if(this.intervalId){
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private onResults(results: PoseLandmarkerResult) {
    const indicesToSkip = [20, 22, 18, 21, 19, 17, 31, 30, 29, 31];
    if (!this.selectedModel || !this.selectedModel.coordenadas || !this.selectedModel.coordenadas.landmarks) {
      console.error('Modelo de referencia no válido o no seleccionado.');
      return;
    }

    if (!this.canvasCtx) return;
    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

    for (const landmark of results.landmarks) {
      this.errorsPose = 0;
      this.errorsPosePoints = '';

      for (let index = 11; index < landmark.length; index++) {
        const point = landmark[index];
        const x = point.x * this.outputCanvas.width; // Coordenada x escalada al tamaño del canvas
        const y = point.y * this.outputCanvas.height; // Coordenada y escalada al tamaño del canvas
        const z = point.z; // Profundidad

        if (indicesToSkip.includes(index)) {
          continue;
        }

        // Asegúrate de que el índice no exceda la longitud del modelo de referencia
        if (index >= this.selectedModel.coordenadas.landmarks.length) {
          console.warn(`El índice ${index} excede el modelo de referencia`);
          continue;
        }

        const modelPoint = this.selectedModel.coordenadas.landmarks[index];
        const tolerance = 40; // Define la tolerancia para x e y

        // Calcular diferencias
        const diffX = x - modelPoint.x;
        const diffY = y - modelPoint.y;

        // Imprimir diferencias
        console.log(`Index: ${index}, Capturado - X: ${x}, Y: ${y}; Modelo - X: ${modelPoint.x}, Y: ${modelPoint.y}; Diferencia - X: ${diffX}, Y: ${diffY}`);


        // Comparar las coordenadas con el rango de tolerancia
        const isXInRange = Math.abs(diffX) <= tolerance;
        const isYInRange = Math.abs(diffY) <= tolerance;

        // Contar errores si alguna coordenada está fuera del rango
        if (!(isXInRange && isYInRange)) {
          this.errorsPose += 1;
          this.errorsPosePoints = this.errorsPosePoints + ` Index: ${index} -`;
        }

        console.log(`Index: ${index}, x=${x}, y=${y}, z=${z}`);
      }
      console.log('Total de Errores: ' + this.errorsPose);
      console.log('Errores: ' + this.errorsPose + ' Points: ' + this.errorsPosePoints);
      if (this.errorsPose <= 3) {
        this.statusPose = 'Buena postura';
        this.FooterColor = 'success';
      } else {
        this.statusPose = 'Mala postura';
        this.FooterColor = 'warning';
      }

      this.drawingUtils.drawLandmarks(landmark, {
        radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1)
      });
      this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
    }

    this.canvasCtx.restore();
  }


  private getJsonModels(){
    this.http.get('assets/mediapipe/pattern/patterns.json').subscribe(
      data => {
        this.jsonData = data;
        this.models = Object.keys(this.jsonData).map(key => ({ name: key, coordenadas: this.jsonData[key] }));
        console.log(this.models);
      },
      error => {
        console.error('Error al cargar el archivo JSON:', error);
      }
    );
  }

  onModelSelect(selectedModel: any, imageUrl: string) {
    console.log('Modelo seleccionado:', selectedModel);
    console.log('URL de la imagen:', imageUrl);

    // Puedes asignar el modelo y la URL a propiedades de la clase si es necesario
    this.selectedModel = selectedModel;
    this.dynamicImageUrl = imageUrl;
  }
}

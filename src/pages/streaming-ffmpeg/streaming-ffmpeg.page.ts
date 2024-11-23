import { Component, ElementRef, AfterViewInit, ViewChild} from '@angular/core';
import { FilesetResolver, PoseLandmarker, DrawingUtils, PoseLandmarkerResult, DrawingOptions } from '@mediapipe/tasks-vision';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Platform } from '@ionic/angular';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import FFmpegStream from 'src/plugins/ffmpeg-stream.plugin';


// Definición de Tipos
interface AngleData {
  expected: number;
  points: [number, number, number]; // Tres índices que forman el ángulo
}

@Component({
  selector: 'app-streaming-ffmpeg',
  templateUrl: './streaming-ffmpeg.page.html',
  styleUrls: ['./streaming-ffmpeg.page.scss'],
})
export class StreamingFfmpegPage implements AfterViewInit  {
  @ViewChild('contentDiv', { static: true }) contentDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('inputImage', {static: true}) inputImage!: ElementRef<HTMLImageElement>;
  //@ViewChild( 'modal', { static: true}) modal!: ElementRef<IonModal>;

  outputCanvas!: HTMLCanvasElement;
  private resizeObserver: ResizeObserver | null = null;
  private canvasCtx!: CanvasRenderingContext2D;
  httpStreamUrl: string | null = null;
  poseLandmarker!: PoseLandmarker;
  drawingUtils!: DrawingUtils;
  drawingOptionsWarning!: DrawingOptions;
  drawingOptinsSuccess!: DrawingOptions;
  dynamicImageUrl: SafeUrl | null = '../assets/Portada_Fondo_-_Camara.png';
  modelImageUrl: SafeUrl | null = '../assets/Portada_Fondo_-_Camara.png';
  intervalId: any;
  lastImageData: string | null = null;
  // rtspUrl: string = 'rtsp://192.168.1.18/1/h264major';
  rtspUrl: string = 'rtsp://192.168.1.183:8080/h264_pcm.sdp';
  startedStream: boolean = false;

  jsonData :any;
  selectedModel: any = null;
  errorsPose:any = 0;
  errorsPosePoints:any = '';
  statusPose:any = 'Estatus de la Postura';
  FooterColor:any = "primary";
  models!:any[];
  step: string = '';
  stepNum: number = 0;
  open = false;
  done = false;
  progress = 0;
  modalProgress = 1;
  progressColor: string = 'danger';

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
    this.open = true;
    try {
      const result = await FFmpegStream.startStream({ rtspUrl: this.rtspUrl });
      this.httpStreamUrl = result.httpUrl;
      console.log('Respuesta: ',this.httpStreamUrl);
    } catch (error) {
      this.dynamicImageUrl = '../assets/Portada_Fondo_-_Camara.png';
      this.statusPose = 'Estatus de la Postura';
      this.FooterColor = "primary";
      this.canvasCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
      this.startedStream = false;
      this.open = false;
      console.error('Error al iniciar la transmisión:', error);
    }
  }

  async cancelStream() {
    console.log('Entro a stop stream');
    try{
      this.startedStream = false;
      await FFmpegStream.stopStream();
      this.stopImageRefresh();
      // this.dynamicImageUrl = '../assets/Portada_Fondo_-_Camara.png';
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
    //this.getJsonModels();
    this.openModal();
    setTimeout(() => {
      this.closeModal();
    }, 5000);
    this.onModelSelect(this.selectedModel);
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

  private getJsonModels(){
    this.http.get('assets/mediapipe/pattern/test-angle-routine.json').subscribe(
      data => {
        this.jsonData = data;
        this.models = Object.keys(this.jsonData).map(key => ({ name: key, coordenadas: this.jsonData[key] }));
        console.log(this.models[0].coordenadas);
        if(this.selectedModel == null){
          this.selectedModel = this.models[this.stepNum];
          console.log(this.selectedModel.coordenadas.instruction);
        }
      },
      error => {
        console.error('Error al cargar el archivo JSON:', error);
      }
    );
  }

  changeExercise(){
    this.stopImageRefresh();
    this.done = true;
    setTimeout(() =>{
      this.done = false;
    },1500);
    this.progress = 0;
    this.stepNum++;
    if(this.stepNum < this.models.length){
      this.selectedModel = this.models[this.stepNum];
      this.startImageRefresh();
    }
  }

  async openModal(){
    const modal = document.querySelector('ion-modal#example-modal') as HTMLIonModalElement;
    await modal?.present();
  }

  async closeModal(){
    const modal = document.querySelector('ion-modal#example-modal') as HTMLIonModalElement;
    await modal?.dismiss();
  }

  async openSuccessModal(){
    const modal = document.querySelector('ion-modal#success-modal') as HTMLIonModalElement;
    await modal?.present();
  }

  async closeSuccessModal(){
    const modal = document.querySelector('ion-modal#success-modal') as HTMLIonModalElement;
    await modal?.dismiss();
  }

  onModelSelect(selectedModel: any) {
    // Puedes asignar el modelo y la URL a propiedades de la clase si es necesario
    //this.selectedModel = selectedModel;
    this.modelImageUrl = selectedModel.coordenadas.imageName;
    this.step = selectedModel.coordenadas.instruction;
  }

  // private onResults(results: PoseLandmarkerResult) {
  //   const allowedIndices = new Set([0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]);

  //   if (!this.selectedModel || !this.selectedModel.coordenadas || !this.selectedModel.coordenadas.landmarks) {
  //     console.error('Modelo de referencia no válido o no seleccionado.');
  //     return;
  //   }

  //   if (!this.canvasCtx) return;
  //   this.canvasCtx.save();
  //   this.canvasCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

  //   for (const landmark of results.landmarks) {
  //     this.errorsPose = 0;
  //     this.errorsPosePoints = '';

  //     for (const modelPoint of this.selectedModel.coordenadas.landmarks) {
  //       const index = modelPoint.index;

  //       // Verificar si el índice está permitido
  //       if (!allowedIndices.has(index)) {
  //         console.log('Index no permitido: ' + index);
  //         continue;
  //       }

  //       // Obtenemos el punto correspondiente del resultado actual
  //       const point = landmark[index];
  //       const x = point.x * this.outputCanvas.width; // Coordenada x escalada al tamaño del canvas
  //       const y = point.y * this.outputCanvas.height; // Coordenada y escalada al tamaño del canvas
  //       const z = point.z; // Profundidad

  //       const tolerance = 40; // Define la tolerancia para x e y

  //       // Calcular diferencias
  //       const diffX = x - modelPoint.x;
  //       const diffY = y - modelPoint.y;

  //       // Imprimir diferencias
  //       console.log(`Index: ${index}, Capturado - X: ${x}, Y: ${y}; Modelo - X: ${modelPoint.x}, Y: ${modelPoint.y}; Diferencia - X: ${diffX}, Y: ${diffY}`);

  //       // Comparar las coordenadas con el rango de tolerancia
  //       const isXInRange = Math.abs(diffX) <= tolerance;
  //       const isYInRange = Math.abs(diffY) <= tolerance;

  //       // Contar errores si alguna coordenada está fuera del rango
  //       if (!(isXInRange && isYInRange)) {
  //         this.errorsPose += 1;
  //         this.errorsPosePoints = this.errorsPosePoints + ` Index: ${index} -`;
  //       }

  //       console.log(`Index: ${index}, x=${x}, y=${y}, z=${z}`);
  //     }

  //     console.log('Total de Errores: ' + this.errorsPose);
  //     console.log('Errores: ' + this.errorsPose + ' Points: ' + this.errorsPosePoints);
  //     if (this.errorsPose <= 3) {
  //       this.statusPose = 'Buena postura';
  //       this.FooterColor = 'success';
  //     } else {
  //       this.statusPose = 'Mala postura';
  //       this.FooterColor = 'warning';
  //     }

  //     this.drawingUtils.drawLandmarks(landmark, {
  //       radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1)
  //     });
  //     this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
  //   }

  //   this.canvasCtx.restore();
  // }

  private calculateAngle(pointA:any, pointB:any, pointC:any): number {
    const vectorBA = { x: pointA.x - pointB.x, y: pointA.y - pointB.y };
    const vectorBC = { x: pointC.x - pointB.x, y: pointC.y - pointB.y };

    const dotProduct = vectorBA.x * vectorBC.x + vectorBA.y * vectorBC.y;
    const magnitudeBA = Math.sqrt(vectorBA.x ** 2 + vectorBA.y ** 2);
    const magnitudeBC = Math.sqrt(vectorBC.x ** 2 + vectorBC.y ** 2);

    const angleInRadians = Math.acos(dotProduct / (magnitudeBA * magnitudeBC));
    return (angleInRadians * 180) / Math.PI; // Convertir a grados
  }

  private onResults(results: PoseLandmarkerResult) {
    if (!this.selectedModel) {
      console.error('Modelo no seleccionado.');
      return;
    }

    if (!this.canvasCtx) return;

    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

    for (const landmark of results.landmarks) {
      this.errorsPose = 0;
      this.errorsPosePoints = '';

      // Procesar ángulos del modelo seleccionado
      for (const [angleName, angleData] of Object.entries(this.selectedModel.coordenadas.angles) as [string, AngleData][]) {
        const [indexA, indexB, indexC] = angleData.points;

        // console.log("--------------Modelo----------" + this.selectedModel.name);

        // Validar que los índices existen en los resultados de los landmarks
        if (!landmark[indexA] || !landmark[indexB] || !landmark[indexC]) {
          console.warn(`No se encontraron los puntos para calcular el ángulo ${angleName}`);
          continue;
        }

        const pointA = landmark[indexA];
        const pointB = landmark[indexB];
        const pointC = landmark[indexC];

        const calculatedAngle = this.calculateAngle(pointA, pointB, pointC);
        const expectedAngle = angleData.expected;


        // Verificar si el ángulo está dentro de la tolerancia
        const isWithinTolerance = Math.abs(calculatedAngle - expectedAngle) <= this.selectedModel.coordenadas.tolerance;
        // console.log('isWithinTolerance: ' + isWithinTolerance);

        if (!isWithinTolerance) {
          this.errorsPose += 1;
          this.errorsPosePoints += ` ${angleName}`;
        }

        //console.log(angleName);
        //console.log(`- Obtenido: ${calculatedAngle}, Esperado: ${expectedAngle}, Diferencia: ${Math.abs(calculatedAngle - expectedAngle)}`);

      }

      // Establecer estado de postura basado en errores
      if (this.errorsPose <= 1) {
        this.statusPose = 'Buena postura';
        //this.FooterColor = 'success';
        this.progress = this.progress + 0.04;
        if(this.progress > 0.5){
          this.progressColor = 'warning';
        }
        if(this.progress > 0.75){
          this.progressColor = 'success';
        }
        if(this.progress >= 1){
          this.changeExercise();
        }
        // Dibujar puntos y conectores en el canvas
        this.drawingUtils.drawLandmarks(landmark, {color: '#00FF00',
          fillColor: '#00FF00',
          lineWidth: 2,
          radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
        });
        this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {color: '#00FF00', fillColor: '#00FF00', lineWidth: 1.5, radius: 3.5});
      } else {
        this.statusPose = 'Mala postura';
        //this.FooterColor = 'warning';
        this.progress = 0;
        this.progressColor = 'danger';
        // Dibujar puntos y conectores en el canvas
        this.drawingUtils.drawLandmarks(landmark, {color: '#FF0000',
          fillColor: '#FF0000',
          lineWidth: 2,
          radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1)
        });
        this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {color: '#FF0000', fillColor: '#FF0000', lineWidth: 1.5, radius: 3.5});
      }

      //console.log('Total de Errores: ' + this.errorsPose + ' Color: ' + this.FooterColor);
      //console.log('Errores: ' + this.errorsPose + ' Points: ' + this.errorsPosePoints);
    }

    this.canvasCtx.restore();
  }
}

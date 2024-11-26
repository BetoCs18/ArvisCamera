import { Component, ElementRef, AfterViewInit, ViewChild} from '@angular/core';
import { FilesetResolver, PoseLandmarker, DrawingUtils, PoseLandmarkerResult, DrawingOptions, NormalizedLandmark } from '@mediapipe/tasks-vision';
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
class ObservableNumber{
  private _value: number = 0;
  private listeners: ((newValue: number) => void)[] = [];

  get value(): number{
    return this._value;
  }

  set value(newValue: number){
    if (this._value !== newValue){
      this._value = newValue;
      this.listeners.forEach((listener) => listener(newValue));
    }
  }

  onChange(listener: (newValue: number) => void){
    this.listeners.push(listener);
  }
}
@Component({
  selector: 'app-streaming-ffmpeg',
  templateUrl: './streaming-ffmpeg.page.html',
  styleUrls: ['./streaming-ffmpeg.page.scss'],
})
export class StreamingFfmpegPage implements AfterViewInit  {
  @ViewChild('contentDiv', { static: true }) contentDiv!: ElementRef<HTMLDivElement>;
  @ViewChild('inputImage', {static: true}) inputImage!: ElementRef<HTMLImageElement>;
  @ViewChild('testImage', {static: true}) testImage!: ElementRef<HTMLImageElement>;
  //@ViewChild( 'modal', { static: true}) modal!: ElementRef<IonModal>;

  outputCanvas!: HTMLCanvasElement;
  inputCanvas!: HTMLCanvasElement;
  private resizeObserver: ResizeObserver | null = null;
  private canvasCtx!: CanvasRenderingContext2D;
  inputCanvasCtx!: CanvasRenderingContext2D;
  httpStreamUrl: string | null = null;
  poseLandmarker!: PoseLandmarker;
  drawingUtils!: DrawingUtils;
  drawingOptionsWarning!: DrawingOptions;
  drawingOptinsSuccess!: DrawingOptions;
  dynamicImageUrl: SafeUrl | null = '../assets/Portada_Fondo_-_Camara.png';
  testImageUrl: SafeUrl | null = '../assets/Portada_Fondo_-_Camara.png';
  modelImageUrl: SafeUrl | null = '../assets/Portada_Fondo_-_Camara.png';
  intervalId: any;
  modalInterval: any;
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
  frame = 0;
  progressColor: string = 'danger';
  private poseResult = new ObservableNumber();

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
      this.inputCanvas = document.createElement('canvas');
      this.inputCanvas.width = this.outputCanvas.width;
      this.inputCanvas.height = this.outputCanvas.height;
      const inputContext = this.inputCanvas.getContext('2d');
      if(inputContext){
        this.inputCanvasCtx = inputContext;
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
      if (!result.data || typeof result.data !== 'string' || result.data.length === 0){
        console.warn("La imagen está vacía o no se pudo leer.");
        return null;
      }
      const imageElement = await this.loadImage(`data:image/jpeg;base64,${result.data}`)
      const isTransparent = await this.checkTransparency(imageElement,this.inputCanvas,this.inputCanvasCtx)
      if(isTransparent){
        console.error('La imagen es transparente');
        return null;
      }
      this.frame++;
      if (this.frame > 2){
        this.testImageUrl = this.sanitizer.bypassSecurityTrustUrl(`${imageElement.src}`);
        this.frame = 0;
      }
      return imageElement;
    } catch (error) {
      console.error('Error al leer el archivo: ', error);
      return null;
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement>{
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
    });
  }

  checkTransparency(imageElement: HTMLImageElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean{
    try{
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(imageElement,0,0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const pixels = imageData.data;

      for(let i = 3; i < pixels.length; i += 4){
        if(pixels[i] < 255){
          console.log('la imagen es transparente');
          return true;
        }
      }
      console.log('la imagen no es transparente');
      return false;
    }catch (error){
      console.error('No se pudo escribir el canvas')
      return true;
    }
  }
  isBlackImage(imageData: ImageData): boolean{
    const pixels = imageData.data;
    let isBlack = true;
    for (let i = 0; i < pixels.length; i += 4){
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      if(r > 10 || g > 10 || b > 10 || a > 10){
        isBlack = false;
        break;
      }
    }
    return isBlack;
  }

  loadTexture(gl: WebGLRenderingContext, imageElement: HTMLImageElement): WebGLTexture | null {
    try{
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageElement);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

      console.log('Textura cargada correctamente.');
      return texture;
    }catch (error) {
      console.error('Error al cargar la textura en WebGL:', error);
      return null;
    }
  }

  async setSeconds(seconds: number){
    let timeZero = 0;
    while (timeZero < seconds){
      timeZero += await this.oneSecond();
    }
    return;
  }

  async oneSecond(): Promise<number>{
    return new Promise((resolve) =>{
      setTimeout(() => resolve(1), 1000);
    })
  }

  private async startImageRefresh() {
    // Ejecuta el refresco de imagen a intervalos
    //this.getJsonModels();
    this.openModal();
    this.modalInterval = setInterval(() => {
      this.modalProgress = this.modalProgress - 0.07;
      if(this.modalProgress <= 0){
        this.modalProgress = 1;
        clearInterval(this.modalInterval);
        this.modalInterval = null;
        this.closeModal();
      }
    }, 1000 / 20);
    this.onModelSelect(this.selectedModel);
    this.intervalId = setInterval(async () => {
      const imageElement = await this.getImageUrl();
      if (imageElement) {
        this.dynamicImageUrl = this.sanitizer.bypassSecurityTrustUrl(`${imageElement.src}`);
        try{
          const poseLandmarkerResult = this.poseLandmarker.detect(imageElement);
          if (poseLandmarkerResult) {
            this.onResultsTest(poseLandmarkerResult, this.selectedModel);
          }
        }catch (error){
          console.error("Error al detectar poses con mediapipe: ", error);
        }
      }
    }, 1000 / 17); // Frecuencia de actualización ajustable
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

  private onResults(results: PoseLandmarkerResult, selectedModel: any) {
    if (!this.canvasCtx) return;

    let landmarksTrue: NormalizedLandmark[][] = results.landmarks;
    let landmarksFalse: NormalizedLandmark[][] = [];
    landmarksFalse[0] = [];

    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

    for (const landmark of results.landmarks) {
      this.errorsPose = 0;
      this.errorsPosePoints = '';

      // Procesar ángulos del modelo seleccionado
      for (const [angleName, angleData] of Object.entries(selectedModel.coordenadas.angles) as [string, AngleData][]) {
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
        const isWithinTolerance = Math.abs(calculatedAngle - expectedAngle) <= selectedModel.coordenadas.tolerance;
        // console.log('isWithinTolerance: ' + isWithinTolerance);

        if (!isWithinTolerance) {
          this.errorsPose += 1;
          this.errorsPosePoints += ` ${angleName}`;
          landmarksFalse[0].push(landmark[indexA]);
          landmarksFalse[0].push(landmark[indexB]);
          landmarksFalse[0].push(landmark[indexC]);
          landmarksTrue[0].splice(indexA);
          landmarksTrue[0].splice(indexB);
          landmarksTrue[0].splice(indexC);
        }

        //console.log(angleName);
        //console.log(`- Obtenido: ${calculatedAngle}, Esperado: ${expectedAngle}, Diferencia: ${Math.abs(calculatedAngle - expectedAngle)}`);

      }

      // Establecer estado de postura basado en errores
      if (this.errorsPose <= 1) {
        this.statusPose = 'Buena postura';
        //this.FooterColor = 'success';
        this.progress = this.progress + 0.05;
        if(this.progress > 0.5){
          this.progressColor = 'warning';
        }
        if(this.progress > 0.75){
          this.progressColor = 'success';
        }
        if(this.progress >= 1){
          this.changeExercise();
        }
        /* Dibujar puntos y conectores en el canvas
        this.drawingUtils.drawLandmarks(landmark, {color: '#00FF00',
          fillColor: '#00FF00',
          lineWidth: 2,
          radius: 2
        });
        this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {color: '#00FF00', fillColor: '#00FF00', lineWidth: 1.5, radius: 3.5});*/
      } else {
        this.statusPose = 'Mala postura';
        //this.FooterColor = 'warning';
        this.progress = 0;
        this.progressColor = 'danger';
        /* Dibujar puntos y conectores en el canvas
        this.drawingUtils.drawLandmarks(landmark, {color: '#FF0000',
          fillColor: '#FF0000',
          lineWidth: 2,
          radius: 2
        });
        this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {color: '#FF0000', fillColor: '#FF0000', lineWidth: 1.5, radius: 3.5});*/
      }
      this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {color: 'white', fillColor: 'white', lineWidth: 1.5, radius: 3.5});
      //console.log('Total de Errores: ' + this.errorsPose + ' Color: ' + this.FooterColor);
      //console.log('Errores: ' + this.errorsPose + ' Points: ' + this.errorsPosePoints);
    }

    for(const landmark of landmarksTrue){
      this.drawingUtils.drawLandmarks(landmark, {color: '#00FF00',
        fillColor: '#00FF00',
        lineWidth: 1,
        radius: 2
      });
    }

    for(const landmark of landmarksFalse){
      this.drawingUtils.drawLandmarks(landmark, {color: '#FF0000',
        fillColor: '#FF0000',
        lineWidth: 1,
        radius: 2
      });
    }
    this.canvasCtx.restore();
  }

  private onResultsTest(results: PoseLandmarkerResult, selectedModel: any) {
    if (!this.canvasCtx) return;

    let landmarksTrue: NormalizedLandmark[][] = [[]];
    let landmarksFalse: NormalizedLandmark[][] = [[]];

    this.errorsPose = 0;
    this.errorsPosePoints = '';

    const tolerance = selectedModel.coordenadas.tolerance;
    const angles = selectedModel.coordenadas.angles;

    for (const [angleName, angleData] of Object.entries(angles) as [string, AngleData][]) {
      const [indexA, indexB, indexC] = angleData.points;
      const landmarks = results.landmarks[0];

      // console.log("--------------Modelo----------" + this.selectedModel.name);

      const pointA = landmarks[indexA];
      const pointB = landmarks[indexB];
      const pointC = landmarks[indexC];

      if (!this.isLandmarkValid(pointA) || !this.isLandmarkValid(pointB) || !this.isLandmarkValid(pointC)) {
        console.warn(`Puntos no válidos para el ángulo ${angleName}`);
        continue;
      }
      // Validar que los índices existen en los resultados de los landmarks

      const calculatedAngle = this.calculateAngle(pointA, pointB, pointC);
      const expectedAngle = angleData.expected;

      // Verificar si el ángulo está dentro de la tolerancia
      // console.log('isWithinTolerance: ' + isWithinTolerance);
      if (Math.abs(calculatedAngle - expectedAngle) > tolerance) {
        this.errorsPose++;
        this.errorsPosePoints += ` ${angleName}`;
        landmarksFalse[0].push(pointA, pointB, pointC);
        //landmarksTrue.splice(indexA);
        //landmarksTrue.splice(indexB);
        //landmarksTrue.splice(indexC);
      }
      //console.log(angleName);
      //console.log(`- Obtenido: ${calculatedAngle}, Esperado: ${expectedAngle}, Diferencia: ${Math.abs(calculatedAngle - expectedAngle)}`);
    }

    landmarksTrue[0].push(...results.landmarks[0].filter(element => !landmarksFalse[0].includes(element)));

    if (this.errorsPose === 0) {
      this.statusPose = 'Buena postura';
      //this.FooterColor = 'success';
      this.progress = Math.min(this.progress + 0.1, 1);
      this.progressColor = this.progress > 0.75 ? 'success' : this.progress > 0.5 ? 'warning' : 'primary';
      if(this.progress === 1){
        this.changeExercise();
      }
    } else {
      this.statusPose = 'Mala postura';
      //this.FooterColor = 'warning';
      this.progress = 0;
      this.progressColor = 'danger';
    }

    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

    for(const landmark of results.landmarks){
      this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {color: 'white', fillColor: 'white', lineWidth: 1.5, radius: 3.5});
    }

    for(const landmark of landmarksTrue){
      this.drawingUtils.drawLandmarks(landmark, {color: '#00FF00',
        fillColor: '#00FF00',
        lineWidth: 1,
        radius: 2
      });
    }

    for(const landmark of landmarksFalse){
      this.drawingUtils.drawLandmarks(landmark, {color: '#FF0000',
        fillColor: '#FF0000',
        lineWidth: 1,
        radius: 2
      });
    }



    this.canvasCtx.restore();
  }

  private isLandmarkValid(landmark: NormalizedLandmark | undefined): boolean {
    return landmark !== undefined && landmark.visibility > 0.5;
  }

  private drawLandmarks(landmarks: NormalizedLandmark[][], color: string) {
    for (const landmark of landmarks) {
      this.drawingUtils.drawLandmarks(landmark, {
        color: color,
        fillColor: color,
        lineWidth: 1,
        radius: 2,
      });
      this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {
        color: color,
        fillColor: color,
        lineWidth: 1.5,
        radius: 3.5,
      });
    }
  }
}


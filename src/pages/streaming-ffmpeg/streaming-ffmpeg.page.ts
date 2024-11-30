import { Component, ElementRef, AfterViewInit, ViewChild} from '@angular/core';
import { FilesetResolver, PoseLandmarker, DrawingUtils, PoseLandmarkerResult, DrawingOptions, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Platform } from '@ionic/angular';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import FFmpegStream from 'src/plugins/ffmpeg-stream.plugin';
import { ActivatedRoute, Router } from '@angular/router';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { firstValueFrom } from 'rxjs';

// Definición de Tipos
interface Data {
  name: string;
  exercises: ExcerciseData[];
}
interface ExcerciseData{
  exerciseName: string;
  route: string;
}
interface Exercise {
  name: string;
  steps: Step[];
  tolerance: number;
  time: number;
  reps: number;
  restTime: number;
}
interface Step {
  name: string;
  imageName: string;
  instruction: string;
  angles: AngleData[];
}
interface AngleData {
  name: string;
  options: [string, string];
  expected: number;
  points: [number, number, number]; // Tres índices que forman el ángulo
  message: string;
  required: boolean;
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

class ObservableBool{
  private _value: boolean = true;
  private listeners: ((newValue: boolean) => void)[] = [];

  get value(): boolean{
    return this._value;
  }

  set value(newValue: boolean){
    if (this._value !== newValue){
      this._value = newValue;
      this.listeners.forEach((listener) => listener(newValue));
    }
  }

  onChange(listener: (newValue: boolean) => void){
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
  exerciseNum: number = 0;
  open = false;
  done = false;
  progress = 0;
  modalProgress = 1;
  frame = 0;
  progressColor: string = 'danger';
  poseResult!: ObservableNumber;
  message = '';
  instruction = '';
  seconds!: number;
  newInterval: any;
  estimation: number = 0;
  evaluationMode: boolean = true;
  modelData!: Data;
  exercises:Exercise[] = [];
  steps: Step[] = [];
  currentExercise!: Exercise;
  currentStep!: Step;
  speech!: ObservableBool;

  constructor(public sanitizer: DomSanitizer, private platform: Platform, private http: HttpClient) {
    this.poseResult = new ObservableNumber();
    this.speech = new ObservableBool();
  }

  ngAfterViewInit() {
    this.initResizeObserver();
    this.getJsonModels();
    this.initValueObserver();
    this.initBoolObserver();
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

  initValueObserver(){
    this.poseResult.onChange((newValue) =>{
      if(newValue === 1){
        this.statusPose = 'Buena postura';
        this.setCountDownBar(this.seconds);
      }else{
        this.statusPose = 'Mala postura';
        this.cancelCountDownBar();
      }
    })
  }

  initBoolObserver(){
    /*this.speech.onChange((newValue) =>{
      if(!newValue){
        this.ActivateSpeech();
      }
    })*/
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
          minPoseDetectionConfidence: 0.7,
          minPosePresenceConfidence: 0.7,
          minTrackingConfidence: 0.7,
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
          minPoseDetectionConfidence: 0.7,
          minPosePresenceConfidence: 0.7,
          minTrackingConfidence: 0.7,
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
        path: 'live/stream.jpeg', // Ruta relativa dentro del directorio de caché
        directory: Directory.Cache,
      });
      if (!result.data || typeof result.data !== 'string' || result.data.length === 0){
        console.warn("La imagen está vacía o no se pudo leer.");
        return null;
      }
      const imageElement = await this.loadImage(`data:image/jpeg;base64,${result.data}`)
      /*const isTransparent = await this.checkTransparency(imageElement,this.inputCanvas,this.inputCanvasCtx)
      if(isTransparent){
        console.error('La imagen es transparente');
        return null;
      }*/
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

  private async startImageRefresh() {
    // Ejecuta el refresco de imagen a intervalos
    if(!this.evaluationMode)this.evaluationMode = true;
    this.onSelectExercise(this.exerciseNum);
    await this.setExerciseModal(5);
    this.intervalId = setInterval(async () => {
      const imageElement = await this.getImageUrl();
      if (imageElement) {
        this.dynamicImageUrl = this.sanitizer.bypassSecurityTrustUrl(`${imageElement.src}`);
        this.estimation++;
        if(this.estimation >= 2){
          try{
            const poseLandmarkerResult = this.poseLandmarker.detect(imageElement);
            if (poseLandmarkerResult) {
              this.onResults(poseLandmarkerResult);
            }
          }catch (error){
            console.error("Error al detectar poses con mediapipe: ", error);
          }
          this.estimation = 0;
        }
      }
    }, 50); // Frecuencia de actualización ajustable
  }

  stopImageRefresh(){
    if(this.intervalId){
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private getJsonModels(){
    this.http.get('assets/mediapipe/pattern/abdomen-routine.json').subscribe(
      data => {
        this.jsonData = data;
        this.models = Object.keys(this.jsonData).map(key => ({ name: key, data: this.jsonData[key] }));
        if(this.selectedModel == null){
          this.selectedModel = this.models[0];
          this.onRoutineSelect(this.selectedModel);
        }
      },
      error => {
        console.error('Error al cargar el archivo JSON:', error);
      }
    );
  }

  /*private async getJsonExercises(path: string): Promise<boolean>{
    try{
      this.http.get(`assets/mediapipe/pattern/${path}`).subscribe(
        data => {
          this.jsonData = data;
          const models = Object.keys(this.jsonData).map(key => ({ name: key, data: this.jsonData[key] }));
          //const response = await this.setModels(models[0].data);
          return true;
        },
        error => {
          console.error('Error al cargar el archivo JSON:', error);
          return false;
        }
      );
      return true;
    }catch (error){
      console.error('Error al cargar el archivo JSON: ', error);
      return false;
    }
  }*/

  async getJsonExercises(path: string): Promise<boolean> {
    try {
      const data = await firstValueFrom(this.http.get(`assets/mediapipe/pattern/${path}`));
      this.jsonData = data;
      const models = Object.keys(this.jsonData).map(key => ({ name: key, data: this.jsonData[key] }));
      const response = await this.setModels(models[0].data);
      return response;
    } catch (error) {
      console.error('Error al cargar el archivo JSON:', error);
      return false;
    }
  }

  changePose(){
    if(this.newInterval){
      clearInterval(this.newInterval);
      this.newInterval = null;
    }
    this.done = true;
    setTimeout(() =>{
      this.done = false;
    },1000);
    this.poseResult.value = 0;
    this.stepNum++;
    if(this.stepNum >= this.steps.length){
      if(this.evaluationMode){
        this.evaluationMode = false;
        console.log("Cambio de ejercicio");
        this.stepNum = 0;
        this.exerciseNum++;
        this.onSelectExercise(this.exerciseNum);
      }
    }else{
      if(this.evaluationMode){
        this.evaluationMode = false;
        console.log("Cambio de paso");
        this.onStepSelect(this.stepNum);
        this.startImageRefresh();
      }
    }
  }

  async setCountDownBar(seconds: number){
    const interval = (1 / seconds);
    this.newInterval = setInterval(async () =>{
      this.progress = Math.min(this.progress + interval, 1);
      this.progressColor = this.progress > 0.75 ? 'success' : this.progress > 0.5 ? 'warning' : 'primary';
      if(this.progress === 1){
        this.poseResult.value = 0;
        this.progress = 0;
        this.stopImageRefresh();
        setTimeout(() => {
          this.changePose();
        }, 500);
      }
    }, 1000)
  }

  finishRoutine(){
    this.canvasCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    this.message = 'Rutina finalizada';
    this.stepNum = 0;
    this.exerciseNum = 0;
    this.selectedModel = this.models[this.stepNum];
    this.dynamicImageUrl = '../assets/Portada_Fondo_-_Camara.png';
  }

  cancelCountDownBar(){
    if(this.newInterval){
      clearInterval(this.newInterval);
      this.newInterval = null;
    }
    this.progress = 0;
    this.progressColor = 'danger';
  }

  async setExerciseModal(seconds: number){
    const interval = (1/seconds);
    if(this.progress === 0)this.progress = 1;
    let timeZero = 0;
    this.openModal();
    this.speak((this.step + this.instruction));
    while(timeZero < seconds){
      timeZero += await this.oneSecond();
      this.modalProgress -= interval;
    }
    this.closeModal();
  }

  async ActivateSpeech(){
    setTimeout(() =>{
      this.speech.value = true;
    }, 5000);
  }

  async setSeconds(seconds: number){
    let timeZero = 0;
    while (timeZero < seconds){
      timeZero += await this.oneSecond();
    }
    return;
  }

  async oneTimeSecond():Promise<number>{
    const currentDate = Date.now();
    let time = 0;
    while(time < 1000){
      time = (Date.now() - currentDate);
    }
    return 1;
  }

  async oneSecond(): Promise<number>{
    return new Promise((resolve) =>{
      setTimeout(() => resolve(1), 1000);
    })
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

  async onRoutineSelect(selectedRoutine: any){
    let modelData: Data = {
      name: selectedRoutine.data.name,
      exercises: []
    };
    for(const exercise of selectedRoutine.data.exercises){
      const exerciseData: ExcerciseData = {
        exerciseName: exercise.exerciseName,
        route: exercise.route
      };
      modelData.exercises.push(exerciseData);
    }
    const response = await this.addExercises(modelData);
    if(response){
      this.onSelectExercise(this.exerciseNum);
    }
  }

  async addExercises(modelData: Data): Promise<boolean>{
    this.modelData = modelData;
    for(const exercise of this.modelData.exercises){
      const addExercise = await this.getJsonExercises(exercise.route);
      if(!addExercise)console.error('Error al cargar json');
    }
    return true;
  }

  async setModels(data: any): Promise<boolean>{
    try{
      console.log(data);
      const exercise: Exercise = {
        name: data.name,
        steps: data.steps,
        tolerance: data.tolerance,
        time: data.time,
        reps: data.reps,
        restTime: data.restTime
      }
      this.exercises.push(exercise);
      return true;
    }catch (error){
      console.error('Error al agregar ejercicio', error);
      return false;
    }
  }

  onSelectExercise(number: number){
    console.log(this.exercises);
    if(number >= this.exercises.length){
      this.finishRoutine();
    }else{
      this.currentExercise = this.exercises[number];
      this.steps = [];
      const angles = this.currentExercise.steps;
      for (const [angleName, angleData] of Object.entries(angles) as [string, Step][]){
        this.steps.push(angleData);
      }
      //setTimeout(() => {
        this.onStepSelect(this.stepNum);
      //}, 1000);
      if(this.exerciseNum > 0 ){
        this.startImageRefresh();
      }
    }
  }

  onStepSelect(stepNum: number){
    this.currentStep = this.steps[stepNum];
    //console.log(this.currentStep);
    this.step = `Paso: ${stepNum+1} ${this.currentStep.name}`;
    this.instruction = this.currentStep.instruction;
    this.seconds = this.currentExercise.time;
    this.modelImageUrl = this.currentStep.imageName;
  }

  onModelSelect(selectedModel: any) {
    // Puedes asignar el modelo y la URL a propiedades de la clase si es necesario
    this.seconds = selectedModel.time;
    this.modelImageUrl = selectedModel.steps.imageName;
  }

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
    if (!this.canvasCtx) return;

    let landmarksTrue: NormalizedLandmark[][] = [[]];
    let landmarksFalse: NormalizedLandmark[][] = [[]];

    this.errorsPose = 0;
    this.errorsPosePoints = '';

    const tolerance = this.currentExercise.tolerance;
    const angles = this.currentStep.angles;

    for (const [angleName, angleData] of Object.entries(angles) as [string, AngleData][]) {
      const [indexA, indexB, indexC] = angleData.points;
      const landmarks = results.landmarks[0];

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
      const difference = calculatedAngle - expectedAngle;

      // Verificar si el ángulo está dentro de la tolerancia
      if (Math.abs(difference) > tolerance) {
        this.errorsPose++;
        landmarksFalse[0].push(pointA, pointB, pointC);
        this.errorsPosePoints += `- ${(difference > 0 ? angleData.options[0] : angleData.options[1])} ${angleData.name}\n`;
      }
      //console.log(angleName);
      //console.log(`- Obtenido: ${calculatedAngle}, Esperado: ${expectedAngle}, Diferencia: ${Math.abs(calculatedAngle - expectedAngle)}`);
    }

    this.message = this.errorsPosePoints;
    if(this.speech.value){
      this.speech.value = false;
      this.speak(this.message);
    }

    landmarksTrue[0].push(...results.landmarks[0].slice(11).filter(element => !landmarksFalse[0].includes(element)));

    if (this.errorsPose === 0) {
      this.poseResult.value = 1;
    } else {
      this.poseResult.value = 0;
    }

    this.canvasCtx.save();
    this.canvasCtx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

    for(const landmark of results.landmarks){
      this.drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, {color: 'white', fillColor: 'white', lineWidth: 1.5, radius: 3.5});
    }

    this.drawLandmarks(landmarksTrue, '#00FF00');

    this.drawLandmarks(landmarksFalse, '#FF0000');

    /*for(const landmark of landmarksTrue){
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
    }*/

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
    }
  }

  async speak(instruction: string) {
    if (instruction.trim()) {
      instruction.replace("-","");
      try {
        await TextToSpeech.speak({
          text: instruction, // Texto a sintetizar
          lang: 'es-ES', // Idioma (ejemplo: español)
          voice: 8,
          volume: 1.0,
          rate: 1.0, // Velocidad de la voz (1.0 es normal)
          pitch: 1.0, // Tono de la voz (1.0 es normal)
        });
        console.log('Texto leído correctamente');
        this.ActivateSpeech();
      } catch (error) {
        console.error('Error al sintetizar voz:', error);
      }
    }
  }
}


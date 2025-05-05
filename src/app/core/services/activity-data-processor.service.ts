import { Injectable, signal } from '@angular/core';
import { PostureState } from '../models/sensor-data.model';

@Injectable({
    providedIn: 'root',
})
export class ActivityDataProcessorService {
    // Señales métricas
    readonly steps = signal<number>(0);
    readonly distance = signal<number>(0);
    readonly posture = signal<PostureState>(PostureState.UNKNOWN);
    readonly hrvRmssd = signal<number | null>(null);
    readonly stressLevel = signal<number | null>(null);
    readonly dribbleCount = signal<number>(0);
    readonly caloriesBurned = signal<number>(0);
    readonly fallDetected = signal<boolean>(false);
    readonly lastFallTimestamp = signal<number | null>(null);

    // Variables de seguimiento
    private _rrHistory: number[] = [];
    private _lastStepTimestamp = 0;
    private _gravity = { x: 0, y: 0, z: 0 };
    private _isFirstAccSample = true;
    private _lastDribbleTimestamp = 0;
    private _activityStartTime = 0;

    // Constantes de configuración
    private readonly STEP_THRESHOLD = 0.5;
    private readonly STEP_COOLDOWN = 350; // ms
    private readonly DRIBBLE_THRESHOLD = 1.8;
    private readonly DRIBBLE_COOLDOWN = 150; // ms
    private readonly FALL_THRESHOLD = 2.5;
    private readonly FALL_WINDOW = 1000; // ms

    /**
     * Procesa una muestra del acelerómetro
     */
    processAccelSample(x: number, y: number, z: number): void {
        // Calcular vector de gravedad con filtro pasa-bajo
        if (this._isFirstAccSample) {
            this._gravity = { x, y, z };
            this._isFirstAccSample = false;
        } else {
            const alpha = 0.1; // Factor de filtrado
            this._gravity.x = this._gravity.x * (1 - alpha) + x * alpha;
            this._gravity.y = this._gravity.y * (1 - alpha) + y * alpha;
            this._gravity.z = this._gravity.z * (1 - alpha) + z * alpha;
        }

        // Calcular aceleración lineal (sin gravedad)
        const linearAccX = x - this._gravity.x;
        const linearAccY = y - this._gravity.y;
        const linearAccZ = z - this._gravity.z;

        // Calcular magnitud de aceleración
        const magnitude = Math.sqrt(
            Math.pow(linearAccX, 2) +
            Math.pow(linearAccY, 2) +
            Math.pow(linearAccZ, 2)
        );

        const now = Date.now();

        // Detección de pasos
        if (magnitude > this.STEP_THRESHOLD && (now - this._lastStepTimestamp) > this.STEP_COOLDOWN) {
            this._lastStepTimestamp = now;
            this.steps.update(steps => steps + 1);
            // Incrementar distancia (0.7m por paso es un valor aproximado)
            this.distance.update(distance => distance + 0.7);
        }

        // Detección de regates (para aplicaciones deportivas)
        if (magnitude > this.DRIBBLE_THRESHOLD && (now - this._lastDribbleTimestamp) > this.DRIBBLE_COOLDOWN) {
            this._lastDribbleTimestamp = now;
            this.dribbleCount.update(count => count + 1);
        }

        // Análisis de postura basado en el ángulo vertical
        const verticalAngle = Math.atan2(
            Math.sqrt(this._gravity.x * this._gravity.x + this._gravity.y * this._gravity.y),
            this._gravity.z
        ) * (180 / Math.PI);

        // Clasificación de postura
        const newPosture = verticalAngle < 30
            ? PostureState.STANDING
            : verticalAngle < 75
                ? PostureState.STOOPED
                : PostureState.LYING;

        this.posture.set(newPosture);

        // Detección de caídas
        if (magnitude > this.FALL_THRESHOLD) {
            const currentTime = Date.now();
            this.fallDetected.set(true);
            this.lastFallTimestamp.set(currentTime);

            // Restablecer estado de caída después de un tiempo
            setTimeout(() => {
                if (this.lastFallTimestamp() === currentTime) {
                    this.fallDetected.set(false);
                }
            }, this.FALL_WINDOW);
        }
    }

    /**
     * Actualiza las calorías quemadas basadas en el ritmo cardíaco
     */
    updateCalories(heartRate: number): void {
        if (!heartRate || heartRate < 40 || heartRate > 240) return;

        if (this._activityStartTime === 0) {
            this._activityStartTime = Date.now();
        }

        // Duración de la actividad en horas
        const activityDurationHours = (Date.now() - this._activityStartTime) / 3600000;

        // Parámetros del usuario (valores medios por defecto)
        const weight = 70; // kg
        const age = 30; // años
        const isMale = true;

        const gender = isMale ? 1 : 0;

        // Fórmula para calorías por minuto basada en HR
        const caloriesPerMinute = ((-55.0969 + (0.6309 * heartRate) +
            (0.1988 * weight) + (0.2017 * age)) / 4.184) *
            (gender ? 1 : 0.85);

        // Calorías totales
        const totalCalories = caloriesPerMinute * (activityDurationHours * 60);

        this.caloriesBurned.set(Math.round(totalCalories));
    }

    /**
     * Inicia una nueva actividad
     */
    startActivity(): void {
        this._activityStartTime = Date.now();
        this.resetActivityData();
    }

    /**
     * Resetea datos de actividad
     */
    resetActivityData(): void {
        this.steps.set(0);
        this.distance.set(0);
        this.posture.set(PostureState.UNKNOWN);
        this.hrvRmssd.set(null);
        this.stressLevel.set(null);
        this.dribbleCount.set(0);
        this.caloriesBurned.set(0);
        this.fallDetected.set(false);
        this.lastFallTimestamp.set(null);

        this._rrHistory = [];
        this._lastStepTimestamp = 0;
        this._gravity = { x: 0, y: 0, z: 0 };
        this._isFirstAccSample = true;
        this._lastDribbleTimestamp = 0;
        this._activityStartTime = Date.now();
    }
}
import { Injectable, signal } from '@angular/core';
import { PostureState } from '../models/sensor-data.model';

@Injectable({
    providedIn: 'root',
})
export class ActivityDataProcessorService {
    // Métricas calculadas
    readonly steps = signal<number>(0);
    readonly distance = signal<number>(0); // En metros
    readonly posture = signal<PostureState>(PostureState.UNKNOWN);
    readonly hrvRmssd = signal<number | null>(null); // HRV Root Mean Square of Successive Differences
    readonly stressLevel = signal<number | null>(null); // Escala 0-100 basada en HRV
    readonly dribbleCount = signal<number>(0);
    readonly caloriesBurned = signal<number>(0); // Estimación aproximada
    readonly fallDetected = signal<boolean>(false);
    readonly lastFallTimestamp = signal<number | null>(null);

    // Variables de seguimiento de actividad
    private _rrHistory: number[] = []; // Para cálculo de HRV
    private _lastStepTimestamp = 0; // Para cálculo de cadencia de pasos
    private _gravity = { x: 0, y: 0, z: 0 }; // Vector de gravedad estimado
    private _isFirstAccSample = true;
    private _lastDribbleTimestamp = 0; // Para cadencia de dribble
    private _activityStartTime = 0; // Para seguimiento de duración para cálculo de calorías

    // Procesar muestra de acelerómetro para detectar pasos y postura
    processAccelSample(x: number, y: number, z: number): void {
        // Actualizar vector de gravedad usando un filtro paso-bajo simple
        if (this._isFirstAccSample) {
            this._gravity = { x, y, z };
            this._isFirstAccSample = false;
        } else {
            // Filtro paso-bajo con alpha = 0.1
            const alpha = 0.1;
            this._gravity.x = this._gravity.x * (1 - alpha) + x * alpha;
            this._gravity.y = this._gravity.y * (1 - alpha) + y * alpha;
            this._gravity.z = this._gravity.z * (1 - alpha) + z * alpha;
        }

        // Eliminar componente de gravedad para obtener aceleración lineal
        const linearAccX = x - this._gravity.x;
        const linearAccY = y - this._gravity.y;
        const linearAccZ = z - this._gravity.z;

        // Calcular magnitud de aceleración lineal
        const magnitude = Math.sqrt(
            Math.pow(linearAccX, 2) +
            Math.pow(linearAccY, 2) +
            Math.pow(linearAccZ, 2)
        );

        // Obtener tiempo actual para cálculos de sincronización
        const now = Date.now();

        // ---- Detección de pasos ----
        const stepThreshold = 0.5; // Umbral de fuerza G para paso
        const stepCooldown = 350; // Tiempo mínimo entre pasos (ms)

        if (magnitude > stepThreshold && (now - this._lastStepTimestamp) > stepCooldown) {
            this._lastStepTimestamp = now;
            this.steps.update(steps => steps + 1);

            // Actualizar distancia (asumiendo 0.7m de longitud de zancada - puede personalizarse)
            this.distance.update(distance => distance + 0.7);
        }

        // ---- Detección de dribble de baloncesto ----
        const dribbleThreshold = 1.8; // Umbral más alto para dribble
        const dribbleCooldown = 150; // Enfriamiento más corto para velocidad de dribble más rápida

        if (magnitude > dribbleThreshold && (now - this._lastDribbleTimestamp) > dribbleCooldown) {
            this._lastDribbleTimestamp = now;
            this.dribbleCount.update(count => count + 1);
        }

        // ---- Detección de postura ----
        const verticalAngle = Math.atan2(
            Math.sqrt(this._gravity.x * this._gravity.x + this._gravity.y * this._gravity.y),
            this._gravity.z
        ) * (180 / Math.PI);

        const newPosture = verticalAngle < 30
            ? PostureState.STANDING
            : verticalAngle < 75
                ? PostureState.STOOPED
                : PostureState.LYING;

        this.posture.set(newPosture);

        // ---- Detección de caídas ----
        const fallThreshold = 2.5; // Fuerza G
        const fallWindow = 1000; // ms

        if (magnitude > fallThreshold) {
            const currentTime = Date.now();
            this.fallDetected.set(true);
            this.lastFallTimestamp.set(currentTime);

            // Resetear detección de caídas después de un retraso
            setTimeout(() => {
                if (this.lastFallTimestamp() === currentTime) {
                    this.fallDetected.set(false);
                }
            }, fallWindow);
        }
    }

    // Actualizar estimación de calorías quemadas basada en ritmo cardíaco
    updateCalories(heartRate: number): void {
        // Omitir si no hay ritmo cardíaco o es inválido
        if (!heartRate || heartRate < 40 || heartRate > 240) return;

        // Inicializar tiempo de inicio de actividad si es necesario
        if (this._activityStartTime === 0) {
            this._activityStartTime = Date.now();
        }

        // Obtener duración de actividad en horas
        const activityDurationHours = (Date.now() - this._activityStartTime) / 3600000;

        // Cálculo simple de calorías quemadas usando ritmo cardíaco
        // Valores predeterminados (pueden personalizarse)
        const weight = 70; // kg
        const age = 30;
        const isMale = true;

        // Constantes de fórmula Keytel
        const gender = isMale ? 1 : 0;

        // Calorías por minuto
        const caloriesPerMinute = ((-55.0969 + (0.6309 * heartRate) + (0.1988 * weight) + (0.2017 * age)) / 4.184) * (gender ? 1 : 0.85);

        // Calorías totales
        const totalCalories = caloriesPerMinute * (activityDurationHours * 60);

        // Actualizar el signal de calorías
        this.caloriesBurned.set(Math.round(totalCalories));
    }

    // Iniciar tiempo de inicio de actividad para conteo de calorías
    startActivity(): void {
        this._activityStartTime = Date.now();
        this.resetActivityData();
    }

    // Resetear datos de actividad
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
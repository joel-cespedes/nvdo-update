import { Injectable, signal } from '@angular/core';
import { PostureState } from '../models/sensor-data.model';

@Injectable({
    providedIn: 'root',
})
export class ActivityDataProcessorService {
    readonly steps = signal<number>(0);
    readonly distance = signal<number>(0);
    readonly posture = signal<PostureState>(PostureState.UNKNOWN);
    readonly hrvRmssd = signal<number | null>(null);
    readonly stressLevel = signal<number | null>(null);
    readonly dribbleCount = signal<number>(0);
    readonly caloriesBurned = signal<number>(0);
    readonly fallDetected = signal<boolean>(false);
    readonly lastFallTimestamp = signal<number | null>(null);

    private _rrHistory: number[] = [];
    private _lastStepTimestamp = 0;
    private _gravity = { x: 0, y: 0, z: 0 };
    private _isFirstAccSample = true;
    private _lastDribbleTimestamp = 0;
    private _activityStartTime = 0;

    processAccelSample(x: number, y: number, z: number): void {
        if (this._isFirstAccSample) {
            this._gravity = { x, y, z };
            this._isFirstAccSample = false;
        } else {
            const alpha = 0.1;
            this._gravity.x = this._gravity.x * (1 - alpha) + x * alpha;
            this._gravity.y = this._gravity.y * (1 - alpha) + y * alpha;
            this._gravity.z = this._gravity.z * (1 - alpha) + z * alpha;
        }

        const linearAccX = x - this._gravity.x;
        const linearAccY = y - this._gravity.y;
        const linearAccZ = z - this._gravity.z;

        const magnitude = Math.sqrt(
            Math.pow(linearAccX, 2) +
            Math.pow(linearAccY, 2) +
            Math.pow(linearAccZ, 2)
        );

        const now = Date.now();

        const stepThreshold = 0.5;
        const stepCooldown = 350;

        if (magnitude > stepThreshold && (now - this._lastStepTimestamp) > stepCooldown) {
            this._lastStepTimestamp = now;
            this.steps.update(steps => steps + 1);
            this.distance.update(distance => distance + 0.7);
        }

        const dribbleThreshold = 1.8;
        const dribbleCooldown = 150;

        if (magnitude > dribbleThreshold && (now - this._lastDribbleTimestamp) > dribbleCooldown) {
            this._lastDribbleTimestamp = now;
            this.dribbleCount.update(count => count + 1);
        }

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

        const fallThreshold = 2.5;
        const fallWindow = 1000;

        if (magnitude > fallThreshold) {
            const currentTime = Date.now();
            this.fallDetected.set(true);
            this.lastFallTimestamp.set(currentTime);

            setTimeout(() => {
                if (this.lastFallTimestamp() === currentTime) {
                    this.fallDetected.set(false);
                }
            }, fallWindow);
        }
    }

    updateCalories(heartRate: number): void {
        if (!heartRate || heartRate < 40 || heartRate > 240) return;

        if (this._activityStartTime === 0) {
            this._activityStartTime = Date.now();
        }

        const activityDurationHours = (Date.now() - this._activityStartTime) / 3600000;

        const weight = 70;
        const age = 30;
        const isMale = true;

        const gender = isMale ? 1 : 0;

        const caloriesPerMinute = ((-55.0969 + (0.6309 * heartRate) + (0.1988 * weight) + (0.2017 * age)) / 4.184) * (gender ? 1 : 0.85);

        const totalCalories = caloriesPerMinute * (activityDurationHours * 60);

        this.caloriesBurned.set(Math.round(totalCalories));
    }

    startActivity(): void {
        this._activityStartTime = Date.now();
        this.resetActivityData();
    }

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
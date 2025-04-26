import { Component, inject, ChangeDetectionStrategy, Signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';

@Component({
    selector: 'app-metrics-display',
    templateUrl: './metrics-display.component.html',
    styleUrls: ['./metrics-display.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DecimalPipe] // Import DecimalPipe for formatting
})
export class MetricsDisplayComponent {
    private readonly movesenseService = inject(MovesenseService);

    // Expose calculated metric signals from the service
    readonly steps: Signal<number> = this.movesenseService.steps;
    readonly distance: Signal<number> = this.movesenseService.distance;
    readonly posture: Signal<string> = this.movesenseService.posture;
    readonly hrvRmssd: Signal<number | null> = this.movesenseService.hrvRmssd;
    readonly stressLevel: Signal<number | null> = this.movesenseService.stressLevel;
    readonly dribbleCount: Signal<number> = this.movesenseService.dribbleCount;
    readonly caloriesBurned: Signal<number> = this.movesenseService.caloriesBurned;
    readonly fallDetected: Signal<boolean> = this.movesenseService.fallDetected; // Added fall detection
    readonly lastFallTimestamp: Signal<number | null> = this.movesenseService.lastFallTimestamp; // Added timestamp
    readonly isConnected: Signal<boolean> = this.movesenseService.isConnected;

    // Helper method for fall timestamp formatting
    formatFallTime(timestamp: number | null): string {
        if (timestamp === null) return 'None detected';
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }
}
import { Component, inject, linkedSignal } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';

@Component({
    selector: 'app-metrics-display',
    templateUrl: './metrics-display.component.html',
    styleUrls: ['./metrics-display.component.scss'],
    standalone: true,
    imports: [CommonModule, DecimalPipe, DatePipe]
})
export class MetricsDisplayComponent {
    private movesenseService = inject(MovesenseService);

    // Link all metrics signals directly from the service
    readonly steps = linkedSignal(this.movesenseService.steps);
    readonly distance = linkedSignal(this.movesenseService.distance);
    readonly posture = linkedSignal(this.movesenseService.posture);
    readonly hrvRmssd = linkedSignal(this.movesenseService.hrvRmssd);
    readonly stressLevel = linkedSignal(this.movesenseService.stressLevel);
    readonly dribbleCount = linkedSignal(this.movesenseService.dribbleCount);
    readonly caloriesBurned = linkedSignal(this.movesenseService.caloriesBurned);
    readonly fallDetected = linkedSignal(this.movesenseService.fallDetected);
    readonly lastFallTimestamp = linkedSignal(this.movesenseService.lastFallTimestamp);
    readonly isConnected = linkedSignal(this.movesenseService.isConnected);

    // Helper method for formatting fall timestamp
    formatFallTime(timestamp: number | null): string {
        if (timestamp === null) return 'Ninguna detectada';
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }
}
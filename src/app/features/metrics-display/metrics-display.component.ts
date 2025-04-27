import { Component, inject, computed } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';

@Component({
    selector: 'app-metrics-display',
    templateUrl: './metrics-display.component.html',
    styleUrls: ['./metrics-display.component.scss'],
    imports: [CommonModule, DecimalPipe, DatePipe]
})
export class MetricsDisplayComponent {
    private movesenseService = inject(MovesenseService);

    // Computed signals para métricas calculadas
    readonly steps = computed(() => this.movesenseService.steps());
    readonly distance = computed(() => this.movesenseService.distance());
    readonly posture = computed(() => this.movesenseService.posture());
    readonly hrvRmssd = computed(() => this.movesenseService.hrvRmssd());
    readonly stressLevel = computed(() => this.movesenseService.stressLevel());
    readonly dribbleCount = computed(() => this.movesenseService.dribbleCount());
    readonly caloriesBurned = computed(() => this.movesenseService.caloriesBurned());
    readonly fallDetected = computed(() => this.movesenseService.fallDetected());
    readonly lastFallTimestamp = computed(() => this.movesenseService.lastFallTimestamp());
    readonly isConnected = computed(() => this.movesenseService.isConnected());

    // Método de ayuda para formateo de timestamp de caída
    formatFallTime(timestamp: number | null): string {
        if (timestamp === null) return 'Ninguna detectada';
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    }
}
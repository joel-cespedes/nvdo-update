import { Component, inject, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';
import { GyroscopeData } from '../../core/models/sensor-data.model';

@Component({
    selector: 'app-gyro-display',
    templateUrl: './gyro-display.component.html',
    styleUrls: ['./gyro-display.component.scss'],
    imports: [CommonModule, DecimalPipe]
})
export class GyroDisplayComponent {
    private movesenseService = inject(MovesenseService);

    // Computed signals
    readonly gyroData = computed<GyroscopeData | null>(
        () => this.movesenseService.gyroscopeData()
    );

    readonly isConnected = computed<boolean>(
        () => this.movesenseService.isConnected()
    );

    // Computed signal para datos de muestras más recientes
    readonly latestSample = computed(() => {
        const data = this.gyroData();
        if (data && data.samples && data.samples.length > 0) {
            return data.samples[data.samples.length - 1];
        }
        return null;
    });
}
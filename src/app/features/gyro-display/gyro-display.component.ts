import { Component, inject, computed, linkedSignal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';

@Component({
    selector: 'app-gyro-display',
    templateUrl: './gyro-display.component.html',
    styleUrls: ['./gyro-display.component.scss'],
    standalone: true,
    imports: [CommonModule, DecimalPipe]
})
export class GyroDisplayComponent {
    private movesenseService = inject(MovesenseService);

    // Link signals from service
    readonly gyroData = linkedSignal(this.movesenseService.gyroscopeData);
    readonly isConnected = linkedSignal(this.movesenseService.isConnected);

    // Computed for latest sample data
    readonly latestSample = computed(() => {
        const data = this.gyroData();
        if (data && data.samples && data.samples.length > 0) {
            return data.samples[data.samples.length - 1];
        }
        return null;
    });
}
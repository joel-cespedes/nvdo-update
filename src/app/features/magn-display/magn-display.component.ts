import { Component, inject, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';
import { MagnetometerData } from '../../core/models/sensor-data.model';

@Component({
    selector: 'app-magn-display',
    templateUrl: './magn-display.component.html',
    styleUrls: ['./magn-display.component.scss'],
    imports: [CommonModule, DecimalPipe]
})
export class MagnDisplayComponent {
    private movesenseService = inject(MovesenseService);

    // Computed signals
    readonly magnData = computed<MagnetometerData | null>(
        () => this.movesenseService.magnetometerData()
    );

    readonly isConnected = computed<boolean>(
        () => this.movesenseService.isConnected()
    );

    // Computed signal para datos de muestras más recientes
    readonly latestSample = computed(() => {
        const data = this.magnData();
        if (data && data.samples && data.samples.length > 0) {
            return data.samples[data.samples.length - 1];
        }
        return null;
    });
}
import { Component, inject, computed, linkedSignal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';

@Component({
    selector: 'app-magn-display',
    templateUrl: './magn-display.component.html',
    styleUrls: ['./magn-display.component.scss'],
    standalone: true,
    imports: [CommonModule, DecimalPipe]
})
export class MagnDisplayComponent {
    private movesenseService = inject(MovesenseService);

    // Link signals from service
    readonly magnData = linkedSignal(this.movesenseService.magnetometerData);
    readonly isConnected = linkedSignal(this.movesenseService.isConnected);

    // Computed for latest sample data
    readonly latestSample = computed(() => {
        const data = this.magnData();
        if (data && data.samples && data.samples.length > 0) {
            return data.samples[data.samples.length - 1];
        }
        return null;
    });
}
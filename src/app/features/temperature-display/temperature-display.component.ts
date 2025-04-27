import { Component, inject, computed } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';
import { TemperatureData } from '../../core/models/sensor-data.model';

@Component({
    selector: 'app-temperature-display',
    templateUrl: './temperature-display.component.html',
    styleUrls: ['./temperature-display.component.scss'],
    imports: [CommonModule, DecimalPipe, DatePipe]
})
export class TemperatureDisplayComponent {
    private movesenseService = inject(MovesenseService);

    // Computed signals
    readonly temperatureData = computed<TemperatureData | null>(
        () => this.movesenseService.temperatureData()
    );

    readonly isConnected = computed<boolean>(
        () => this.movesenseService.isConnected()
    );
}
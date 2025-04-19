import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { AsyncPipe, DecimalPipe, DatePipe } from '@angular/common'; // Import necessary pipes
import { MovesenseService, TemperatureData } from '../../core/services/movesense.service';
import { Signal } from '@angular/core'; // Import Signal type

@Component({
    selector: 'app-temperature-display',
    templateUrl: './temperature-display.component.html',
    styleUrls: ['./temperature-display.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [AsyncPipe, DecimalPipe, DatePipe], // Add pipes to imports for standalone component
    // standalone: true is default
})
export class TemperatureDisplayComponent {
    private readonly movesenseService = inject(MovesenseService);

    // Expose the signal directly from the service
    readonly temperatureData: Signal<TemperatureData | null> = this.movesenseService.temperatureData;
    readonly isConnected: Signal<boolean> = this.movesenseService.isConnected;
}
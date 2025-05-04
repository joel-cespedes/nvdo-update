
import { Component, inject, signal, effect, OnDestroy, linkedSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';

@Component({
  selector: 'app-memory-recording',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './memory-recording.component.html',
  styleUrls: ['./memory-recording.component.scss']
})
export class MemoryRecordingComponent implements OnDestroy {
  private movesenseService = inject(MovesenseService);

  // Link signals from service utilizando linkedSignal
  readonly isConnected = linkedSignal(this.movesenseService.isConnected);
  readonly isRecording = linkedSignal(this.movesenseService.isMemoryRecording);
  readonly recordingStatus = linkedSignal(this.movesenseService.memoryRecordingStatus);
  readonly hasStoredRecordings = linkedSignal(this.movesenseService.hasStoredMemoryRecordings);
  readonly bytesDownloaded = linkedSignal(this.movesenseService.bytesDownloaded);

  // Contador de tiempo transcurrido
  readonly secondsElapsed = signal<number>(0);
  private timerInterval: number | null = null;

  constructor() {
    // Efecto para monitorear cambios en el estado de grabación
    effect(() => {
      const status = this.recordingStatus();

      // Si comienza a grabar, iniciar el contador
      if (status === 'recording' && !this.timerInterval) {
        this.secondsElapsed.set(0);
        this.startTimer();
      }

      // Si deja de grabar, detener el contador
      if (status !== 'recording' && this.timerInterval) {
        this.stopTimer();
      }
    });
  }

  startRecording(): void {
    console.log('Iniciando grabación en memoria desde componente');
    this.movesenseService.startMemoryRecording();
  }

  stopRecording(): void {
    console.log('Deteniendo grabación en memoria desde componente');
    this.movesenseService.stopMemoryRecording();
  }

  private startTimer(): void {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
    }

    this.timerInterval = window.setInterval(() => {
      this.secondsElapsed.update(val => val + 1);
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }
}
// src/app/features/memory-recording-list/memory-recording-list.component.ts
import { Component, inject, signal, linkedSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoredMemoryRecording } from '../../core/models/memory-recording.model';
import { MovesenseService } from '../../core/services/movesense.service';
import { MemoryRecordingViewerComponent } from '../memory-recording-viewer/memory-recording-viewer.component';
import { MemoryStorageService } from '../../core/services/memory-storage.service';

@Component({
  selector: 'app-memory-recording-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MemoryRecordingViewerComponent],
  templateUrl: './memory-recording-list.component.html',
  styleUrl: './memory-recording-list.component.scss'
})
export class MemoryRecordingListComponent {
  private movesenseService = inject(MovesenseService);
  private memoryStorageService = inject(MemoryStorageService);

  // Link storage signals
  readonly storedRecordings = linkedSignal(this.movesenseService.storedMemoryRecordings);
  readonly hasStoredRecordings = linkedSignal(this.movesenseService.hasStoredMemoryRecordings);

  // Component state signals
  readonly selectedRecordingId = signal<string | null>(null);
  readonly newRecordingName = signal<string>('');

  selectRecording(id: string): void {
    if (this.selectedRecordingId() === id) {
      this.selectedRecordingId.set(null);
    } else {
      this.selectedRecordingId.set(id);

      // Set default name from selected recording
      const recording = this.movesenseService.getMemoryRecordingById(id);
      if (recording) {
        this.newRecordingName.set(recording.name || '');
      }
    }
  }

  saveRecordingName(): void {
    const id = this.selectedRecordingId();
    if (id && this.newRecordingName()) {
      this.movesenseService.renameMemoryRecording(this.newRecordingName(), id);
    }
  }

  deleteRecording(id: string, event: Event): void {
    event.stopPropagation(); // Prevent selection on delete

    if (confirm('¿Estás seguro de que deseas eliminar esta grabación?')) {
      this.movesenseService.deleteMemoryRecording(id);

      if (this.selectedRecordingId() === id) {
        this.selectedRecordingId.set(null);
      }
    }
  }

  formatDateShort(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  updateNewName(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newRecordingName.set(input.value);
  }
  clearAllRecordings(): void {

    // Acceder al servicio de almacenamiento a través del servicio MoveSense
    this.memoryStorageService.clearAllRecordings();

  }
}
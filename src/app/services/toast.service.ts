import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private _toasts = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this._toasts.asObservable();

  show(message: string, type: ToastType = 'info', duration = 4000) {
    const toast: Toast = { id: this.nextId++, type, message };
    this._toasts.next([...this._toasts.value, toast]);
    if (duration > 0) setTimeout(() => this.dismiss(toast.id), duration);
  }

  success(message: string) { this.show(message, 'success'); }
  error(message: string) { this.show(message, 'error', 6000); }
  info(message: string) { this.show(message, 'info'); }

  dismiss(id: number) {
    this._toasts.next(this._toasts.value.filter((t) => t.id !== id));
  }
}

import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CriticalRequestService {
  private readonly countSubject = new BehaviorSubject<number>(0);

  readonly count$ = this.countSubject
    .asObservable()
    .pipe(distinctUntilChanged());

  readonly hasCriticalRequests$ = this.count$.pipe(
    map((count) => count > 0),
    distinctUntilChanged(),
  );

  get count(): number {
    return this.countSubject.value;
  }

  begin(): void {
    this.countSubject.next(this.countSubject.value + 1);
  }

  end(): void {
    this.countSubject.next(Math.max(0, this.countSubject.value - 1));
  }
}

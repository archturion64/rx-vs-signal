import { ChangeDetectionStrategy, Component, Inject, Injectable, OnDestroy } from '@angular/core';
import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { FormControl, FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, Observable, Subject, switchMap, takeUntil, tap, withLatestFrom } from 'rxjs';
import { injectTrpcClient } from '../../trpc-client';
import { Note } from '../../db';
import { ActivatedRoute, Router } from '@angular/router';
import { RouteMeta } from '@analogjs/router';

interface NoteDataClientInterface {
  notes$: Observable<Note[]>,
  totalNotesCount$: Observable<number>,
  loading$: Observable<boolean>,
  error$: Observable<string | null>,

  username$: Observable<string>,
  setUsername(username: string): void,

  loadNotes(): void,
  addNote(note: string): void,
  deleteNote(id: number): void,

  setFilterTerm(term: string): void,
  filteredNotes$: Observable<Note[]>,
  filteredNotesCount$: Observable<number>,

  showRefresh$: Observable<boolean>,
}

@Injectable()
class NoteDataClient implements NoteDataClientInterface, OnDestroy {
  private _trpc = injectTrpcClient();
  private _destroy$ = new Subject<void>();
  private _refreshTimer: any;
  private _filterTerm$ = new BehaviorSubject<string>('');
  private _loadNotes$ = new Subject<void>();
  private _addNote$ = new Subject<string>();
  private _removeNote$ = new Subject<number>();

  /* ===============  Interface Impl =============== */
  public notes$ = new BehaviorSubject<Note[]>([]);
  public totalNotesCount$ = this.notes$.pipe(map(notes => notes.length));
  public loading$ = new BehaviorSubject<boolean>(false);
  public error$ = new BehaviorSubject<string | null>(null);

  public username$ = new BehaviorSubject<string>('');
  setUsername(username: string): void {
    this.username$.next(username);
    this.loadNotes();
  }

  loadNotes(): void {
    this._loadNotes$.next();
  }

  addNote(note: string): void {
    this._addNote$.next(note);
  }

  deleteNote(id: number): void {
    this._removeNote$.next(id);
  }

  setFilterTerm(term: string): void {
    this._filterTerm$.next(term);
  }

  public filteredNotes$ = combineLatest([
    this.notes$,
    this._filterTerm$.pipe(
      distinctUntilChanged()
    )
  ]).pipe(
    map(([notes, term]) => this.filterNotes(notes, term))
  );

  public filteredNotesCount$ = this.filteredNotes$.pipe(map(notes => notes.length));

  public showRefresh$ = new BehaviorSubject<boolean>(false);

  /* ===============  Interface Impl End =============== */


  constructor() {
    // Load notes effect
    this._loadNotes$.pipe(
      tap(() => {
        this.setLoading(true);
      }),
      withLatestFrom(this.username$),
      switchMap(([_, username]) => {
       return  this._trpc.note.list.query({person: username })}
      ),
      takeUntil(this._destroy$)
    ).subscribe({
      next: (notes) => {
        this.notes$.next(notes);
        this.setLoading(false);
        this.resetRefreshTimer();
      },
      error: err => {
        this.setLoading(false);
        this.error$.next(err.message);
      }
    });

    // Add note effect
    this._addNote$.pipe(
      tap(() => this.setLoading(true)),
      withLatestFrom(this.username$),
      switchMap(([noteText, username]) => this._trpc.note.create.mutate({ note: noteText, person: username })),
      takeUntil(this._destroy$)
    ).subscribe({
      next: () => {
        this._loadNotes$.next();
        this.setLoading(false);
      },
      error: err => {
        this.setLoading(false);
        this.error$.next(err.message);
      }
    });

    // Remove note effect
    this._removeNote$.pipe(
      tap(() => this.setLoading(true)),
      switchMap(id => this._trpc.note.remove.mutate({ id })),
      takeUntil(this._destroy$)
    ).subscribe({
      next: () => {
        this._loadNotes$.next();
        this.setLoading(false);
      },
      error: err => {
        this.setLoading(false);
        this.error$.next(err.message);
      }
    });

    this.username$.pipe(takeUntil(this._destroy$)).subscribe({next: () => this._loadNotes$.next()})

  }

  private resetRefreshTimer() {
    // Clear existing timer
    clearTimeout(this._refreshTimer);
    this.showRefresh$.next(false);

    // Set new timer
    this._refreshTimer = setTimeout(() => {
      this.showRefresh$.next(true);
    }, 4000);
  }

  private filterNotes(notes: Note[], term: string): Note[] {
    if (!term) return notes;

    // Split search terms and convert to lowercase
    const searchTerms = term.toLowerCase().split(' ').filter(t => t);

    return notes.filter(note => {
      const noteContent = note.note.toLowerCase();
      const noteDate = new Date(note.createdAt).toLocaleDateString().toLowerCase();

      // Check if all search terms match
      return searchTerms.every(term =>
        noteContent.includes(term) ||
        noteDate.includes(term)
      );
    });
  }

  private setLoading(isLoading: boolean) {
    this.loading$.next(isLoading);
    if (isLoading) this.error$.next(null);
  }

  ngOnDestroy() {
    clearTimeout(this._refreshTimer);
    this._destroy$.next();
    this._destroy$.complete();
  }
}

export const routeMeta: RouteMeta = {
  title: 'rxjs',
};

@Component({
  selector: 'demo-rxjs',
  imports: [AsyncPipe, FormsModule, ReactiveFormsModule, NgFor, DatePipe, NgIf],
  providers: [NoteDataClient],
  host: {
    class:
      'flex min-h-screen flex-col text-zinc-900 bg-zinc-50 px-4 pt-8 pb-32',
  },
  template: `
    <main class="flex-1 mx-auto">
      <div class="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Enter your name"
          [formControl]="nameControl"
          class="flex-1 inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background border border-input hover:text-zinc-950 h-11 px-2 rounded-md"
        />
        <button
          (click)="updateNameParam()"
          class="inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:bg-zinc-100 hover:text-zinc-950 h-11 px-8 rounded-md"
        >
          Set Name
        </button>
      </div>

        <!-- Add greeting -->
        <div *ngIf="noteDataClient.username$ | async as username" class="mb-8 text-center">
          <h2 class="text-2xl font-bold text-[#DD0031]">
            Hello {{ username }}! 👋
          </h2>
          <p class="text-zinc-600 mt-2">Here are your notes:</p>
        </div>
      <section id="trpc-demo" class="py-8 md:py-12 lg:py-24">
        <div class="mb-4 text-center bg-zinc-100 p-4 rounded-lg" *ngIf="(noteDataClient.loading$ | async) === false">
          <h3 class="text-lg font-medium text-[#DD0031]">
            <span class="text-2xl font-bold">{{ noteDataClient.filteredNotesCount$ | async }}</span>
            of
            <span class="text-2xl font-bold">{{ noteDataClient.totalNotesCount$ | async }}</span>
            notes
          </h3>
        </div>
        <div class="mb-4 flex justify-center gap-2" *ngIf="noteDataClient.showRefresh$ | async">
          <button
            (click)="refreshNotes()"
            [disabled]="(noteDataClient.loading$ | async) === true"
            class="..."
            [class.opacity-50]="(noteDataClient.loading$ | async) === true"
          >
            {{ (noteDataClient.loading$ | async) ? 'Refreshing...' : 'Refresh Notes' }}
          </button>
        </div>
        <div class="mt-4 mb-2">
          <input
            type="text"
            placeholder="Filter notes..."
            (input)="noteDataClient.setFilterTerm($any($event.target).value)"
            class="w-full inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background border border-input hover:text-zinc-950 h-11 px-2 rounded-md"
          />
        </div>
        <div
          class="mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center"
        >
          <h2 class="text-[#DD0031] font-medium text-3xl leading-[1.1]">
            Leave a note
          </h2>
          <p
            class="max-w-[85%] leading-normal sm:text-lg sm:leading-7"
          >
            This is an example of how you can use tRPC to superpower your
            client-server interaction.
          </p>
        </div>
        <form
          class="mt-8 pb-2 flex items-center"
          #f="ngForm"
          (ngSubmit)="addNote(f)"
        >
          <label class="sr-only" for="newNote"> Note </label>
          <input
            required
            autocomplete="off"
            name="newNote"
            [(ngModel)]="newNote"
            class="w-full inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:text-zinc-950 h-11 px-2 rounded-md"
          />
          <button
            class="ml-2 inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background border border-input hover:bg-zinc-100 hover:text-zinc-950 h-11 px-8 rounded-md"
          >
            +
          </button>
        </form>
        <div *ngIf="noteDataClient.error$ | async as error; else noerror" class="font-bold text-red-900">
          Error: {{error}}
        </div>
        <div *ngIf="noteDataClient.loading$ | async as loading">
          <p class="text-center mt-4">Loading...{{loading}}</p>
        </div>
        <ng-template #noerror>
          <div class="mt-4" *ngIf="noteDataClient.filteredNotes$ | async as filteredNotes;">
            <div
              class="note mb-4 p-4 font-normal border border-input rounded-md"
              *ngFor="let note of filteredNotes; trackBy: noteTrackBy; let i = index"
            >
              <div class="flex items-center justify-between">
                <p class="text-sm text-zinc-400">{{ note.createdAt | date }}</p>
                <button
                  [attr.data-testid]="'removeNoteAtIndexBtn' + i"
                  class="inline-flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background hover:bg-zinc-100 hover:text-zinc-950 h-6 w-6 rounded-md"
                  (click)="removeNote(note.id)"
                >
                  x
                </button>
              </div>
              <p class="mb-4">{{ note.note }}</p>
            </div>
            <ng-container *ngIf="(noteDataClient.notes$ | async) as notes">
              <div
                class="no-notes text-center rounded-xl p-20"
                *ngIf="notes.length !== 0 && filteredNotes.length === 0"
              >
                <h3 class="text-xl font-medium">No notes matching filter!</h3>
                <p class="text-zinc-400">
                  Change your criteria and see them appear here...
                </p>
              </div>
              <div
                class="no-notes text-center rounded-xl p-20"
                *ngIf="notes.length === 0"
              >
                <h3 class="text-xl font-medium">No notes yet!</h3>
                <p class="text-zinc-400">
                  Add a new one and see them appear here...
                </p>
              </div>
            </ng-container>
          </div>

        </ng-template>
      </section>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export default class RxjsComponent implements OnDestroy {

  public newNote = '';
  public nameControl = new FormControl<string>('', {nonNullable: true});
  private destroy$ = new Subject<void>();

  constructor(
    @Inject(NoteDataClient) protected noteDataClient: NoteDataClientInterface,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const name = params.get('name') ?? '';
      this.nameControl.setValue(name);
      this.noteDataClient.setUsername(name);
    });
  }

  public refreshNotes() {
    this.noteDataClient.loadNotes();
  }

  public noteTrackBy = (index: number, note: Note) => {
    return note.id;
  };

  public addNote(form: NgForm) {
    if (!form.valid) {
      form.form.markAllAsTouched();
      return;
    }
    this.noteDataClient.addNote(this.newNote);
    this.newNote = '';
    form.form.reset();
  }

  public removeNote(id: number) {
    this.noteDataClient.deleteNote(id);
  }

  protected updateNameParam() {
    const name = this.nameControl.value.trim();
    this.router.navigate([], {
      queryParams: { name: name || null },
      queryParamsHandling: 'merge'
    });
    this.noteDataClient.setUsername(name);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

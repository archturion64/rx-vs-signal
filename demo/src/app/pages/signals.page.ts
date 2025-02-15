import { ChangeDetectionStrategy, Component, computed, effect, Inject, Injectable, input, linkedSignal, OnDestroy, ResourceStatus, Signal, signal, untracked } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormControl, FormsModule, NgForm, ReactiveFormsModule } from '@angular/forms';
import { Subject, switchMap, takeUntil, tap } from 'rxjs';
import { injectTrpcClient } from '../../trpc-client';
import { Note } from '../../db';
import { Router } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouteMeta } from '@analogjs/router';

export interface NoteDataClientInterface {
  notes: Signal<Note[]>,
  totalNotesCount: Signal<number>,
  loading: Signal<boolean>,
  error: Signal<string | null>,

  username: Signal<string>,
  setUsername(username: string): void,

  loadNotes(): void,
  addNote(note: string): void,
  deleteNote(id: number): void

  setFilterTerm(term: string): void,
  filteredNotes: Signal<Note[]>,
  filteredNotesCount: Signal<number>,

  showRefresh: Signal<boolean>,
}

@Injectable()
class NoteDataClient implements NoteDataClientInterface, OnDestroy {
  private _trpc = injectTrpcClient();


  private noteResource = rxResource({
    request: () => ({username: this.username()}),
    loader: ({request}) =>  this._trpc.note.list.query({person: request.username })
  });

  notes = computed(() => this.noteResource.value() ?? []);
  totalNotesCount = computed(() => this.notes().length);
  loading = computed(() => this.noteResource.isLoading() || this.loadingDelete() || this.loadingCreate());
  error = computed(() => (this.noteResource.error() ? 'Fetch of notes failed' : null) || this.errorCreate() || this.errorDelete());

  username = signal<string>('');
  setUsername(username: string): void {
    this.username.set(username);
  }

  loadNotes(): void {
    this.noteResource.reload();
  }

  addNote(note: string): void {
    this.addNote$.next(note);
  }

  deleteNote(id: number): void {
    this.removeNote$.next(id);
  }

  setFilterTerm(term: string): void {
    this.filterText.set(term);
  }
  private filterText = signal<string>('');

  filteredNotes = computed(() => {
    const searchTerms = this.filterText().toLowerCase().split(' ').filter(term => term);
    if (searchTerms.length === 0) {
      return this.notes();
    }

    return this.notes().filter(item => {
      const lowerItem = item.note.toLowerCase() + ' ' + new Date(item.createdAt).toLocaleDateString().toLowerCase();
      return searchTerms.every(term => lowerItem.includes(term));
    });
  });

  filteredNotesCount = computed(() => this.filteredNotes().length);

  private loadingDelete = signal<boolean>(false);
  private errorDelete = signal<string | null>(null);
  private loadingCreate = signal<boolean>(false);
  private errorCreate = signal<string | null>(null);
  private addNote$ = new Subject<string>();
  private removeNote$ = new Subject<number>();

  private timerId = 0 as any;

  showRefresh = linkedSignal({
    source: this.noteResource.status,
    computation: (status) => {
      if (this.timerId > 0) {
        clearTimeout(this.timerId);
      }
      if (status === ResourceStatus.Resolved) {
        this.timerId = setTimeout(() => {
          this.showRefresh.set(true);
          this.timerId = 0;
        }, 4000);
      }
      return false;
    }
  });

  constructor() {
    this.addNote$.pipe(
      tap(() => {
        this.loadingCreate.set(true);
        this.errorCreate.set(null);
      }),
      switchMap((noteText) => this._trpc.note.create.mutate({ note: noteText, person: this.username() })),
      takeUntil(this._destroy$)
    ).subscribe({
      next: () => {
        this.loadNotes();
        this.loadingCreate.set(false);
      },
      error: err => this.errorCreate.set(err.message),
    });

    this.removeNote$.pipe(
      tap(() => {
        this.loadingDelete.set(true);
        this.errorDelete.set(null);
      }),
      switchMap(id => this._trpc.note.remove.mutate({ id })),
      takeUntil(this._destroy$)
    ).subscribe({
      next: () => {
        this.loadNotes();
        this.loadingDelete.set(false);
      },
      error: err => this.errorDelete.set(err.message),
    });

  }

  private _destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

}

export const routeMeta: RouteMeta = {
  title: 'signals',
};

@Component({
  selector: 'demo-signals',
  imports: [FormsModule, ReactiveFormsModule, NgFor, DatePipe, NgIf],
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
      <div *ngIf="noteDataClient.username()" class="mb-8 text-center">
        <h2 class="text-2xl font-bold text-[#DD0031]">
          Hello {{ noteDataClient.username() }}! 👋
        </h2>
        <p class="text-zinc-600 mt-2">Here are your notes:</p>
      </div>
      <section id="trpc-demo" class="py-8 md:py-12 lg:py-24">
        <div class="mb-4 text-center bg-zinc-100 p-4 rounded-lg" *ngIf="!(noteDataClient.loading())">
          <h3 class="text-lg font-medium text-[#DD0031]">
            <span class="text-2xl font-bold">{{ noteDataClient.filteredNotesCount() }}</span>
            of
            <span class="text-2xl font-bold">{{ noteDataClient.totalNotesCount() }}</span>
            notes
          </h3>
        </div>
        <div class="mb-4 flex justify-center gap-2" *ngIf="noteDataClient.showRefresh()">
          <button
            (click)="refreshNotes()"
            [disabled]="(noteDataClient.loading())"
            class="..."
            [class.opacity-50]="(noteDataClient.loading())"
          >
            {{ (noteDataClient.loading()) ? 'Refreshing...' : 'Refresh Notes' }}
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
        <div *ngIf="noteDataClient.error(); else noerror" class="font-bold text-red-900">
          Error: {{ noteDataClient.error() }}
        </div>
        <div *ngIf="noteDataClient.loading()">
          <p class="text-center mt-4">Loading...{{ noteDataClient.loading() }}</p>
        </div>
        <ng-template #noerror>
          <div class="mt-4" *ngIf="noteDataClient.filteredNotes() as  filteredNotes;">
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
            <ng-container *ngIf="(noteDataClient.notes()) as notes">
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
export default class DemoSignalsComponent implements OnDestroy {

  public newNote = '';
  public nameControl = new FormControl<string>('', {nonNullable: true});
  private destroy$ = new Subject<void>();

  name = input<string>(); // router provided
  #onNameParamChange = effect(() => {
    const name = this.name() ?? '';
    untracked(() => {
      this.nameControl.setValue(name);
      this.noteDataClient.setUsername(name);
    });
  });

  constructor(
    @Inject(NoteDataClient) protected noteDataClient: NoteDataClientInterface,
    private router: Router
  ) {
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


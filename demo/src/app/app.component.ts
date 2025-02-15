import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'demo-root',
  imports: [FormsModule, RouterModule],
  template: ` 
    <div class="flex gap-4 p-4 bg-gray-100 rounded-lg">
      <label class="flex items-center gap-2 cursor-pointer">
        <input 
          type="radio" 
          name="paradigm" 
          value="rxjs" 
          [(ngModel)]="selectedParadigm"
          (ngModelChange)="onRadioBtnChange($event)"
          class="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
        >
        <span class="text-gray-700">RxJS</span>
      </label>
      
      <label class="flex items-center gap-2 cursor-pointer">
        <input 
          type="radio" 
          name="paradigm" 
          value="signals" 
          [(ngModel)]="selectedParadigm"
          (ngModelChange)="onRadioBtnChange($event)"
          class="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
        >
        <span class="text-gray-700">Signals</span>
      </label>
    </div>
    <router-outlet/> 
  `,
})
export class AppComponent {
  protected selectedParadigm: 'rxjs' | 'signals' = 'rxjs';

  constructor(private router: Router) {}

  ngOnInit() {
    this.navigateToParadigm(this.selectedParadigm);
  }

  onRadioBtnChange(paradigm: 'rxjs' | 'signals') {
    this.navigateToParadigm(paradigm);
  }

  private navigateToParadigm(paradigm: string) {
    this.router.navigate([paradigm], {queryParamsHandling: 'preserve'});
  }
}

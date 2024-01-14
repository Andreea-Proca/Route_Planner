import { Component, OnInit, Inject } from '@angular/core';
import { FirebaseService } from "src/app/services/database/firebase";
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.scss']
})

export class ReviewComponent implements OnInit {
  selectedRoute = '';
  rating = 0;
  reviewText = '';
  routes: any[];

  // Error control
  reviewSuccess = false;
  reviewError = false;

  constructor(
    private fbs: FirebaseService,
    @Inject(MAT_DIALOG_DATA) public anyVariable
  ) { }

  onSubmit() {
    const reviewData = {
      stars: this.rating,
      text: this.reviewText
    };
    console.log(reviewData);
    this.fbs.addReviewToRoute(this.selectedRoute, reviewData);
    this.reviewSuccess = true;
    setTimeout(() => this.reviewSuccess = false, 3000);
  }

  updateRating(newRating: number) {
    this.rating = newRating;
  }

  getRoutesFromFirebase() {
    this.fbs.extractUserRoutes().subscribe(
      (routesFromDb) => {
        this.routes = routesFromDb;
      },
      (error) => {
        console.error('Error fetching routes from Firebase', error);
      }
    );
  }

  ngOnInit() {
    this.getRoutesFromFirebase();
  }
}

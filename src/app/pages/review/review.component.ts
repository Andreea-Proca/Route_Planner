import { Component, OnInit } from '@angular/core';
import { EsriMapComponent } from 'src/app/pages/esri-map/esri-map.component';
import { FirebaseService, IRouteItem, ITestItem } from "src/app/services/database/firebase";

@Component({
  selector: 'app-review',
  templateUrl: './review.component.html',
  styleUrls: ['./review.component.scss']
})

export class ReviewComponent implements OnInit {
  selectedRoute = '';
  rating = 0;
  reviewText = '';
  routes:  any[];

  // Error control
  reviewSuccess = false;
  reviewError = false;

  constructor(
    private fbs: FirebaseService
  ) { }



  onSubmit() {
    const reviewData = {
      stars: this.rating,
      text: this.reviewText
    };
    console.log(reviewData);
    this.fbs.addReviewToRoute(this.selectedRoute, reviewData);
    this.reviewSuccess = true;
    setTimeout( () => this.reviewSuccess = false, 3000);
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

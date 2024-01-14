import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import Point from '@arcgis/core/geometry/Point';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators'

export interface ITestItem {
    name: string,
    lat: number,
    lng: number
}

export interface IReview {
    stars: number,
    text: string
}

export interface IPoint {
    x: number,
    y: number
}

export interface IRouteItem {
    name: string,
    // lat1: number,
    // lng1: number,
    // lat2: number,
    // lng2: number,
    points: IPoint[],
    user: string,
    reviews: IReview[]
}

@Injectable()
export class FirebaseService {

    listFeed: Observable<any[]>;
    objFeed: Observable<any>;

    constructor(public db: AngularFireDatabase) {

    }

    connectToDatabase() {
        this.listFeed = this.db.list('list').valueChanges();
        this.objFeed = this.db.object('obj').valueChanges();
    }

    getChangeFeedList() {
        return this.listFeed;
    }

    getChangeFeedObj() {
        return this.objFeed;
    }

    addPointItem(lat: number, lng: number) {
        let item: ITestItem = {
            name: "test",
            lat: lat,
            lng: lng
        };
        this.db.list('list').push(item);
    }

    addRouteItem(points: Array<IPoint>, name: string, user: string) {
    // addRouteItem(lat1: number, lng1: number, lat2: number, lng2: number, name: string, user: string) {
        let item: IRouteItem = {
            name: name,
            // lat1: lat1,
            // lng1: lng1,
            // lat2: lat2,
            // lng2: lng2,
            points: points,
            user: user,
            reviews: []
        };
        this.db.list('list').push(item);
    }

    extractUserRoutes() {
        return this.db.list('list').valueChanges();
    }

    syncPointItem(lat: number, lng: number) {
        let item: ITestItem = {
            name: "test",
            lat: lat,
            lng: lng
        };
        this.db.object('obj').set([item]);
    }

    addReviewToRoute(routeName: string, review: IReview) {
        const routesRef = this.db.list<IRouteItem>('list', ref =>
            ref.orderByChild('name').equalTo(routeName)
        );
        routesRef.snapshotChanges().pipe(take(1)).subscribe(actions => {
            actions.forEach(action => {
                const route: IRouteItem = action.payload.val();
                if (route) {
                    const reviews = route.reviews ? [...route.reviews, review] : [review];
                    this.db.object(`list/${action.key}`).update({ reviews: reviews });
                }
            });
        });
    }
}
/*
  Copyright 2019 Esri
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  OnDestroy
} from "@angular/core";

import esri = __esri; // Esri TypeScript Types

import { Subscription } from "rxjs";
import { FirebaseService, ITestItem } from "src/app/services/database/firebase";
import { FirebaseMockService } from "src/app/services/database/firebase-mock";
import { getAuth } from "firebase/auth";
import Config from '@arcgis/core/config';
import WebMap from '@arcgis/core/WebMap';
import MapView from '@arcgis/core/views/MapView';

import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';

import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import RouteParameters from '@arcgis/core/rest/support/RouteParameters';
import * as route from "@arcgis/core/rest/route.js";

import Search from '@arcgis/core/widgets/Search.js';
import Locate from "@arcgis/core/widgets/Locate.js";
import Compass from "@arcgis/core/widgets/Compass.js";
import Fullscreen from "@arcgis/core/widgets/Fullscreen.js";


import { geocode } from "@esri/arcgis-rest-geocoding"
import { ApiKeyManager } from "@esri/arcgis-rest-request";
import { getCategories } from "@esri/arcgis-rest-places";
import { findPlacesWithinExtent } from "@esri/arcgis-rest-places";
import * as locator from "@arcgis/core/rest/locator.js";
import PictureMarkerSymbol from '@arcgis/core/symbols/PictureMarkerSymbol';
import WebStyleSymbol from '@arcgis/core/symbols/WebStyleSymbol';
import ActionButton from '@arcgis/core/support/actions/ActionButton.js';
import { AuthService } from "src/app/services/auth";
// const auth = getAuth();

@Component({
  selector: "app-esri-map",
  templateUrl: "./esri-map.component.html",
  styleUrls: ["./esri-map.component.scss"]
})
export class EsriMapComponent implements OnInit, OnDestroy {
  // The <div> where we will place the map
  @ViewChild("mapViewNode", { static: true }) private mapViewEl: ElementRef;

  // Instances
  map: esri.Map;
  view: esri.MapView;
  pointGraphic: esri.Graphic;
  graphicsLayer: esri.GraphicsLayer;

  dropDownElement: HTMLElement;

  // Current route
  startPoint: Point;
  destinationPoint: Point;

  // Attributes
  zoom = 10;
  center: Array<number> = [-118.73682450024377, 34.07817583063242];
  basemap = "streets-vector";
  loaded = false;
  pointCoords: number[] = [-118.73682450024377, 34.07817583063242];
  dir: number = 0;
  count: number = 0;
  timeoutHandler = null;


  // firebase sync
  isConnected: boolean = false;
  subscriptionList: Subscription;
  subscriptionObj: Subscription;

  searchWidget: Search;
  locateWidget: Locate;
  compassWidget: Compass;
  fullscreenWidget: Fullscreen;
  locatorWidget: locator;

  constructor(
    private authService: AuthService,
    private fbs: FirebaseService
  ) { }

  async initializeMap() {
    try {

      // Configure the Map
      const mapProperties: esri.WebMapProperties = {
        basemap: this.basemap
      };
      console.log("aici")

      Config.apiKey = "AAPKba863a01015c4ac0abf7e38b281f64604o_R5CzYPymg8lQ_DGiRpc00YTXy2pGxe7YsZUU3LmcxW9xrS0eQgEzDywhaJeiP";

      this.map = new WebMap(mapProperties);

      this.addFeatureLayers();
      this.addGraphicLayers();

      this.dropDownElement = document.getElementById("routes");


      this.addPoint(this.pointCoords[1], this.pointCoords[0], true);

      // Initialize the MapView
      const mapViewProperties = {
        container: this.mapViewEl.nativeElement,
        center: this.center,
        zoom: this.zoom,
        map: this.map
      };

      this.view = new MapView(mapViewProperties);

      // Initialize the Search widget
      this.searchWidget = new Search({
        view: this.view
      });
      this.view.ui.add(this.searchWidget, {
        position: "bottom-right",
        index: 1
      });

      this.locateWidget = new Locate({
        view: this.view,   // Attaches the Locate button to the view
        // graphic: new Graphic({
        //   symbol: { type: "simple-marker" }  // overwrites the default symbol used for the
        //   // graphic placed at the location of the user when found
        // })
      });
      this.view.ui.add(this.locateWidget, {
        position: "top-left",
        index: 0
      });

      this.compassWidget = new Compass({
        view: this.view
      });
      this.view.ui.add(this.compassWidget, {
        position: "top-left",
        index: 2
      });

      this.fullscreenWidget = new Fullscreen({
        view: this.view
      });
      this.view.ui.add(this.fullscreenWidget, {
        position: "top-left",
        index: 0
      });


      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/park.png", "park", "park");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/mountain.png", "mountain", "mountain");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/trail.png", "trail", "trail");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/campground.png","campground", "campground");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/landmark.png", "Tourist Attraction", "landmark");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/train-station.png", "train station", "train-station");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/grocery-store.png", "grocery", "grocery-store");


      this.view.when(() => {
        console.log("ArcGIS map loaded");
        console.log("Map center: " + this.view.center.latitude + ", " + this.view.center.longitude);
      });

      // Fires `pointer-move` event when user clicks on "Shift"
      // key and moves the pointer on the view.
      this.view.on('pointer-move', ["Shift"], (event) => {
        let point = this.view.toMap({ x: event.x, y: event.y });
        console.log("map moved: ", point.longitude, point.latitude);
      });

      await this.view.when(); // wait for map to load
      console.log("ArcGIS map loaded");
      console.log("Map center: " + this.view.center.latitude + ", " + this.view.center.longitude);
      this.addRouter();
      return this.view;
    } catch (error) {
      console.log("EsriLoader: ", error);
    }
  }


  findPlaces(pt,  category: string, icon: string) {
    const geocodingServiceUrl = "http://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer";

    const params = {
      address: null,
      categories: [category],
      location: pt,  // Paris (2.34602,48.85880)
      outFields: ["PlaceName", "Place_addr"]
    }

    locator.addressToLocations(geocodingServiceUrl, params).then((results) => {
      for (let item of results) {
        this.addIcon(item.location.latitude, item.location.longitude, true, icon)
      }
      //   this.addPoint(48.85877, 2.34612);
      console.log(results)
    });
  }

  addGraphicLayers() {
    this.graphicsLayer = new GraphicsLayer();
    this.map.add(this.graphicsLayer);
  }

  addFeatureLayers() {
    // Trailheads feature layer (points)
    var trailheadsLayer: __esri.FeatureLayer = new FeatureLayer({
      url:
        "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trailheads/FeatureServer/0"
    });

    this.map.add(trailheadsLayer);

    // Trails feature layer (lines)
    var trailsLayer: __esri.FeatureLayer = new FeatureLayer({
      url:
        "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trails/FeatureServer/0"
    });

    this.map.add(trailsLayer, 0);

    // Parks and open spaces (polygons)
    var parksLayer: __esri.FeatureLayer = new FeatureLayer({
      url:
        "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Parks_and_Open_Space/FeatureServer/0"
    });

    this.map.add(parksLayer, 0);

    console.log("feature layers added");
  }

  addPoint(lat: number, lng: number, register: boolean) {
    let point = new Point({
      longitude: lng,
      latitude: lat
    });

    const simpleMarkerSymbol = {
      type: "simple-marker",
      color: [226, 119, 40],  // Orange
      outline: {
        color: [255, 255, 255], // White
        width: 1
      }
    };
    let pointGraphic: esri.Graphic = new Graphic({
      geometry: point,
      symbol: simpleMarkerSymbol
    });

    this.graphicsLayer.add(pointGraphic);
    if (register) {
      this.pointGraphic = pointGraphic;
    }
  }

  removePoint() {
    if (this.pointGraphic != null) {
      this.graphicsLayer.remove(this.pointGraphic);
    }
  }

  addIcon(lat: number, lng: number, register: boolean, category: string) {
    const point = new Point({
      longitude: lng,
      latitude: lat
    });
  
    const webStyleSymbol = new WebStyleSymbol({
      name: category,
      styleName: "Esri2DPointSymbolsStyle"
    });

    const pointGraphic = new Graphic({
      geometry: point,
      symbol: webStyleSymbol
    });
  
    this.graphicsLayer.add(pointGraphic);
  
    if (register) {
      this.pointGraphic = pointGraphic;
    }
  }  

  buttonFunc(url: string, category: string, icon: string) {
    const button = document.createElement('button');
    button.innerHTML = `<img src=${url} alt="Icon" />`;
    button.className = 'esri-widget--button esri-widget esri-interactive';
    button.addEventListener('click', () => { this.findPlaces(this.view.center, category, icon); });
    this.view.ui.add(button, 'top-left');
  }

  addRouter() {
    const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

    this.view.on("click", (event) => {
      console.log("point clicked: ", event.mapPoint.latitude, event.mapPoint.longitude);
      console.log(this.view.graphics.length);
      if (this.view.graphics.length === 0) {
        addGraphic("origin", event.mapPoint);
        this.startPoint = new Point(event.mapPoint);
      } else if (this.view.graphics.length === 1) {
        addGraphic("destination", event.mapPoint);
        this.destinationPoint = new Point(event.mapPoint);
        getRoute(); // Call the route service
      } else {
        this.view.graphics.removeAll();
        addGraphic("origin", event.mapPoint);
        this.startPoint = new Point(event.mapPoint);
      }
    });

    var addGraphic = (type: any, point: any) => {
      const graphic = new Graphic({
        symbol: {
          type: "simple-marker",
          color: (type === "origin") ? "white" : "black",
          size: "8px"
        } as any,
        geometry: point
      });
      this.view.graphics.add(graphic);
    }

    var getRoute = () => {
      const routeParams = new RouteParameters({
        stops: new FeatureSet({
          features: this.view.graphics.toArray()
        }),
        returnDirections: true
      });

      route.solve(routeUrl, routeParams).then((data: any) => {
        for (let result of data.routeResults) {
          result.route.symbol = {
            type: "simple-line",
            color: [5, 150, 255],
            width: 3
          };
          this.view.graphics.add(result.route);
        }

        // Display directions
        if (data.routeResults.length > 0) {
          const directions: any = document.createElement("ol");
          directions.classList = "esri-widget esri-widget--panel esri-directions__scroller";
          directions.style.marginTop = "0";
          directions.style.padding = "15px 15px 15px 30px";
          const features = data.routeResults[0].directions.features;

          let sum = 0;
          // Show each direction
          features.forEach((result: any, i: any) => {
            sum += parseFloat(result.attributes.length);
            const direction = document.createElement("li");
            direction.innerHTML = result.attributes.text + " (" + result.attributes.length + " miles)";
            directions.appendChild(direction);
          });

          sum = sum * 1.609344;
          console.log('dist (km) = ', sum);
          this.view.ui.empty("top-right");
          this.view.ui.add(directions, "top-right");
        }
      }).catch((error: any) => {
        console.log(error);
      });
    }
  }

  runTimer() {
    this.timeoutHandler = setTimeout(() => {
      // code to execute continuously until the view is closed
      // ...
      this.animatePointDemo();
      this.runTimer();
    }, 200);
  }

  animatePointDemo() {
    this.removePoint();
    switch (this.dir) {
      case 0:
        this.pointCoords[1] += 0.01;
        break;
      case 1:
        this.pointCoords[0] += 0.02;
        break;
      case 2:
        this.pointCoords[1] -= 0.01;
        break;
      case 3:
        this.pointCoords[0] -= 0.02;
        break;
    }

    this.count += 1;
    if (this.count >= 10) {
      this.count = 0;
      this.dir += 1;
      if (this.dir > 3) {
        this.dir = 0;
      }
    }

    this.addPoint(this.pointCoords[1], this.pointCoords[0], true);
    this.fbs.syncPointItem(this.pointCoords[1], this.pointCoords[0]);
  }

  stopTimer() {
    if (this.timeoutHandler != null) {
      clearTimeout(this.timeoutHandler);
      this.timeoutHandler = null;
    }
  }

  connectFirebase() {
    if (this.isConnected) {
      return;
    }
    this.isConnected = true;
    this.fbs.connectToDatabase();
    this.subscriptionList = this.fbs.getChangeFeedList().subscribe((items: ITestItem[]) => {
      console.log("got new items from list: ", items);
      this.graphicsLayer.removeAll();
      for (let item of items) {
        this.addPoint(item.lat, item.lng, false);
      }
    });
    this.subscriptionObj = this.fbs.getChangeFeedObj().subscribe((stat: ITestItem[]) => {
      console.log("item updated from object: ", stat);
    });
  }

  addPointItem() {
    console.log("Map center: " + this.view.center.latitude + ", " + this.view.center.longitude);
    this.fbs.addPointItem(this.view.center.latitude, this.view.center.longitude);
  }

  addRouteItem() {
    
    console.log("Map center: " + this.view.center.latitude + ", " + this.view.center.longitude);
    if (this.startPoint !== null && this.destinationPoint !== null) {
      this.fbs.addRouteItem(this.startPoint.latitude, this.startPoint.longitude,this.destinationPoint.latitude, this.destinationPoint.longitude, "traseu1");
      const newRoute = document.createElement("option");
      const routePoints = {
        lat1: this.startPoint.latitude,
        lng1: this.startPoint.longitude,
        lat2: this.destinationPoint.latitude,
        lng2: this.destinationPoint.longitude
      };
      newRoute.text = "traseu1"
      newRoute.value = JSON.stringify(routePoints);
      this.dropDownElement.appendChild(newRoute);
    }
    
    console.log("aici");
    console.log(getAuth());
    // console.log(this.fbs.getChangeFeedList());
  }

  disconnectFirebase() {
    if (this.subscriptionList != null) {
      this.subscriptionList.unsubscribe();
    }
    if (this.subscriptionObj != null) {
      this.subscriptionObj.unsubscribe();
    }
  }

  ngOnInit() {
    // Initialize MapView and return an instance of MapView
    console.log("initializing map");
    console.log(this.authService);
    this.initializeMap().then(() => {
      // The map has been initialized
      console.log("mapView ready: ", this.view.ready);
      this.loaded = this.view.ready;
      //this.runTimer();
    });
  }

  ngOnDestroy() {
    if (this.view) {
      // destroy the map view
      this.view.container = null;
    }
   // this.stopTimer();
    this.disconnectFirebase();
  }

}



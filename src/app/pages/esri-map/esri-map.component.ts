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
import { FirebaseService, IRouteItem, ITestItem } from "src/app/services/database/firebase";
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
import Popup from "@arcgis/core/widgets/Popup.js";

import { FormControl, FormGroup, Validators } from "@angular/forms";
import { stringToKeyValue } from "@angular/flex-layout/extended/style/style-transforms";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import PopupTemplate from "@arcgis/core/PopupTemplate.js";
import Legend from '@arcgis/core/widgets/Legend';

import LayerList from "@arcgis/core/widgets/LayerList.js";
import { MatDialogRef, MatDialog } from '@angular/material/dialog';
import { ReviewComponent } from "../review/review.component";

import("@arcgis/core/widgets/support/widgetUtils")
  .then((widgetUtilsModule) => {
    const sanitize = widgetUtilsModule.renderingSanitizer.sanitize;

    widgetUtilsModule.renderingSanitizer.sanitize = function (b, c) {
      return (typeof b == "string") ? b : sanitize.call(this, b, c);
    };
  })
  .catch(error => {
    console.error("Failed to load the module: ", error);
  });

@Component({
  selector: "app-esri-map",
  templateUrl: "./esri-map.component.html",
  styleUrls: ["./esri-map.component.scss"]
})


// const medical_unitLayer = new FeatureLayer({
//   url: 'https://services.arcgis.com/IjJbzDQF4hOiNl87/arcgis/rest/services/medical_punct/FeatureServer/0',
// });
// const food_storeLayer = new FeatureLayer({
//   url: 'https://services8.arcgis.com/BBQ8y8wlr7sbDPZa/arcgis/rest/services/restaurante_bune_romania/FeatureServer/0',
// });
// const storeLayer = new FeatureLayer({
//   url: 'https://services8.arcgis.com/BBQ8y8wlr7sbDPZa/arcgis/rest/services/locuri_shopping_romania/FeatureServer',
// });
// const accommodation_unitsLayer = new FeatureLayer({
//   url: 'https://services7.arcgis.com/v0CEu87DMHNQuNtr/arcgis/rest/services/Unitati_cazare/FeatureServer',
// });
// const tourist_attractionsLayer = new FeatureLayer({
//   url: 'https://services8.arcgis.com/BBQ8y8wlr7sbDPZa/arcgis/rest/services/tourist_attractions_in_romania/FeatureServer',
// });
// const natural_attractionsLayer = new FeatureLayer({
//   url: 'https://services8.arcgis.com/BBQ8y8wlr7sbDPZa/arcgis/rest/services/atractii_naturale/FeatureServer',
// });
// const natural_parksLayer = new FeatureLayer({
//   url: 'https://services6.arcgis.com/r68JIXMFLInRYbAg/arcgis/rest/services/Parcuri_Naturale_RO/FeatureServer',
// });
// const virgin_forestsLayer = new FeatureLayer({
//   url: 'https://services6.arcgis.com/r68JIXMFLInRYbAg/arcgis/rest/services/Paduri/FeatureServer',
// });


export class EsriMapComponent implements OnInit, OnDestroy {
  // The <div> where we will place the map
  @ViewChild("mapViewNode", { static: true }) private mapViewEl: ElementRef;

  // Instances
  map: esri.Map;
  view: esri.MapView;
  pointGraphic: esri.Graphic;
  graphicsLayer: esri.GraphicsLayer;

  dropDownElement: HTMLElement;

  dropDownUserElement: HTMLElement;

  selectedDropDown: string = "routes";

  // Current route
  startPoint: Point;
  destinationPoint: Point;

  // Attributes
  zoom = 10;
  center: Array<number> = [25.009431, 45.944286];
  basemap = "streets-vector";
  loaded = false;
  pointCoords: number[] = [25.009431, 45.944286];
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

  routeForm: FormGroup;
  legendOn: boolean = true;
  layerOn = true;
  layerList: LayerList;
  routeClickCounter: boolean = false;

  constructor(
    private authService: AuthService,
    private fbs: FirebaseService,
    private matDialog: MatDialog
  ) { }

  async initializeMap() {
    try {

      // Configure the Map
      const mapProperties: esri.WebMapProperties = {
        //basemap: this.basemap
        portalItem: {
          id: "6f90bddf9cec4e81aee4e2dcefe7169d"
        }
      };
      console.log("aici")

      Config.apiKey = "AAPKba863a01015c4ac0abf7e38b281f64604o_R5CzYPymg8lQ_DGiRpc00YTXy2pGxe7YsZUU3LmcxW9xrS0eQgEzDywhaJeiP";

      this.map = new WebMap(mapProperties);

      //this.addFeatureLayers();
      this.addGraphicLayers();

      this.dropDownElement = document.getElementById("routes");

      this.addPoint(this.pointCoords[1], this.pointCoords[0], true);

      // Initialize the MapView
      const mapViewProperties = {
        container: this.mapViewEl.nativeElement,
        center: this.center,
        zoom: this.zoom,
        map: this.map,
        popup: {
          dockEnabled: true,
          dockOptions: {
            buttonEnabled: false,
            breakpoint: false
          }
        }
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

      this.layerList = new LayerList({
        view: this.view
      });
      const buttonLayer = document.createElement('button');
      buttonLayer.innerHTML = `<img src=${"https://cdn3.iconfinder.com/data/icons/font-awesome-solid/512/list-check-512.png"} alt="Icon" style="width: 20px; height: 20px;"/>`;
      buttonLayer.className = 'esri-widget--button esri-widget esri-interactive';
      buttonLayer.addEventListener('click', () => {
        if (this.layerOn) {
          this.view.ui.add(this.layerList, {
            position: "top-right"
          });
        } else {
          this.view.ui.remove(this.layerList);
        }
        this.layerOn = !this.layerOn;
      });
      this.view.ui.add(buttonLayer, 'top-right');
      this.showPopup("Layer list", buttonLayer);


      // this.buttonLayer("medical unit");
      // this.buttonLayer("food store");
      // this.buttonLayer("store");
      // this.buttonLayer("accommodation units");
      // this.buttonLayer("tourist attractions");
      // this.buttonLayer("natural attraction");
      // this.buttonLayer("natural parks");
      // this.buttonLayer("virgin forests");

      const legend = new Legend({
        view: this.view,
      });
      const buttonLegend = document.createElement('button');
      buttonLegend.innerHTML = `<img src=${"https://cdn2.iconfinder.com/data/icons/halloween-filled-outline-1/512/24._scroll_magic_halloween_legend_story_fantasy-512.png"} alt="Icon" style="width: 20px; height: 20px;"/>`;
      buttonLegend.className = 'esri-widget--button esri-widget esri-interactive';
      buttonLegend.addEventListener('click', () => {
        if (this.legendOn) {
          this.view.ui.add(legend, 'bottom-left');
        } else {
          this.view.ui.remove(legend);
        }
        this.legendOn = !this.legendOn;
      });
      this.view.ui.add(buttonLegend, 'bottom-left');
      this.showPopup("Legend", buttonLegend);

      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/park.png", "park", "park");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/mountain.png", "mountain", "mountain");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/trail.png", "trail", "trail");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/campground.png", "campground", "campground");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/landmark.png", "Tourist Attraction", "landmark");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/train-station.png", "train station", "train-station");
      this.buttonFunc("https://cdn.arcgis.com/sharing/rest/content/items/220936cc6ed342c9937abd8f180e7d1e/resources/styles/thumbnails/grocery-store.png", "grocery", "grocery-store");

      this.buttonLayer("Medical units");
      this.buttonLayer("Restaurants");
      this.buttonLayer("Stores");
      this.buttonLayer("Hotels and hostels");
      this.buttonLayer("Tourist attractions");
      this.buttonLayer("Natural attractions");
      this.buttonLayer("Parks");
      this.buttonLayer("Forests");
      this.buttonLayer("Rivers");

      // const button = document.createElement('button');
      // button.innerHTML = `<img src=${"https://cdn3.iconfinder.com/data/icons/mother-earth-day-6/64/Recycle_bin-trash_can-trash_bin-ecology-garbage-512.png"} alt="Icon" style="width: 20px; height: 20px;"/>`;
      // button.className = 'esri-widget--button esri-widget esri-interactive';
      // button.addEventListener('click', () => { this.map.removeAll(); this.addGraphicLayers(); });
      // this.view.ui.add(button, 'bottom-left');
      // this.showPopup("remove all filters", button);

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
      //this.addRouter();
      return this.view;
    } catch (error) {
      console.log("EsriLoader: ", error);
    }
  }

  showPopup(name: string, button: any) {
    button.addEventListener('mouseover', () => {
      var rect = button.getBoundingClientRect();

      var x = rect.left + rect.width / 2;
      var y = rect.top + rect.height / 2;
      var screenPoint = {
        x: x,
        y: y,
        // spatialReference: this.view.spatialReference
      };
      var mapPoint = this.view.toMap(screenPoint);

      this.view.openPopup({
        title: name,
        content: `<div>Click here to see ${name} in this area.</div>`,
        location: mapPoint
      });
    });

    button.addEventListener('mouseout', () => { this.view.closePopup(); });
  }


  findPlaces(pt, category: string, icon: string) {
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

  // addFeatureLayers() {
  //   // Trailheads feature layer (points)
  //   var trailheadsLayer: __esri.FeatureLayer = new FeatureLayer({
  //     url:
  //       "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trailheads/FeatureServer/0"
  //   });

  //   this.map.add(trailheadsLayer);

  //   // Trails feature layer (lines)
  //   var trailsLayer: __esri.FeatureLayer = new FeatureLayer({
  //     url:
  //       "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Trails/FeatureServer/0"
  //   });

  //   this.map.add(trailsLayer, 0);

  //   // Parks and open spaces (polygons)
  //   var parksLayer: __esri.FeatureLayer = new FeatureLayer({
  //     url:
  //       "https://services3.arcgis.com/GVgbJbqm8hXASVYi/arcgis/rest/services/Parks_and_Open_Space/FeatureServer/0"
  //   });

  //   this.map.add(parksLayer, 0);

  //   console.log("feature layers added");
  // }

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

  showUserRoutes() {
    this.selectedDropDown = "userRoutes";
    this.showRouteFromDropdown();
  }

  showAllRoutes() {
    this.selectedDropDown = "routes";
    this.showRouteFromDropdown();
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

    this.showPopup(category, button);
  }

  buttonLayer(name: string) {
    var urlIcon = "";
    var group = "";
    switch (name) {
      case "Medical units": {
        urlIcon = "https://cdn4.iconfinder.com/data/icons/hospital-element-1/64/first_aid_kit-healthcare-medical-first_aid-medical_equipment-hospital-512.png"; break;
      }
      case "Restaurants": {
        urlIcon = "https://cdn1.iconfinder.com/data/icons/grocery-14/64/shopping_basket-basket-shopping_store-supermarkets-food-512.png"; break;
      }
      case "Stores": {
        urlIcon = "https://cdn1.iconfinder.com/data/icons/grocery-14/64/supermarket-shop-store-online_store-commerce-512.png"; break;
      }
      case "Hotels and hostels": {
        urlIcon = "https://cdn1.iconfinder.com/data/icons/emoji-122/64/sleep-emoji-emoticon-feeling-sleeping-face-512.png"; break;
      }
      case "Tourist attractions": {
        urlIcon = "https://cdn4.iconfinder.com/data/icons/hotel-services-46/64/map-tourist-destination-direction-attraction-512.png"; break;
      }
      case "Natural attractions": {
        group = "Nature attarctions";
        urlIcon = "https://cdn4.iconfinder.com/data/icons/location-flat/64/Location-map-pin-attractions-favorite-place-512.png"; break;
      }
      case "Parks": {
        group = "Nature attractions";
        urlIcon = "https://cdn4.iconfinder.com/data/icons/landscape-filled/64/landscape_land_terrain-07-512.png"; break;
      }
      case "Forests": {
        group = "Nature attractions";
        urlIcon = "https://cdn3.iconfinder.com/data/icons/tree-42/64/25-tree-garden-yard-gardening-botanical-512.png"; break;
      }
      case "Rivers": {
        group = "Nature attractions";
        urlIcon = "https://cdn3.iconfinder.com/data/icons/landscape-1/402/19-512.png"; break;
      }
      default: { break; }
    }
    const button = document.createElement('button');
    button.innerHTML = `<img src=${urlIcon} alt="Icon" style="width: 20px; height: 20px;"/>`;
    button.className = 'esri-widget--button esri-widget esri-interactive';

    button.addEventListener('click', () => {
      let desiredLayer;
      // let groupLayer;
      // if (group === "") {
      this.layerList.operationalItems.forEach(layerListItem => {
        if (layerListItem.title === name) {
          desiredLayer = layerListItem.layer;
        }
      });
      // } else {
      //   console.log(group);
      //   for (const layer of this.map.layers) {
      //     if (layer.title === group && layer.type === "group") {
      //       groupLayer = layer;
      //     }
      //   }
      //   for (const layerListItem of groupLayer.layers) {
      //     if (layerListItem.title === name) {
      //       desiredLayer = layerListItem.layer;
      //     }
      //   }
      //   console.log(desiredLayer);
      // }

      desiredLayer.visible = !desiredLayer.visible;
    });

    this.view.ui.add(button, 'bottom-right');

    this.showPopup(name, button);
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
      //this.animatePointDemo();
      this.runTimer();
    }, 200);
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

  viewUserRoutes() {

    // console.log(userRoutes);
  }

  addRouteItem() {
    console.log("Map center: " + this.view.center.latitude + ", " + this.view.center.longitude);
    if (this.startPoint !== null && this.destinationPoint !== null) {
      this.fbs.addRouteItem(this.startPoint.latitude, this.startPoint.longitude, this.destinationPoint.latitude, this.destinationPoint.longitude, this.routeForm.value.name, this.authService.userData.uid);
      // const newRoute = document.createElement("option");
      // const routePoints = {
      //   lat1: this.startPoint.latitude,
      //   lng1: this.startPoint.longitude,
      //   lat2: this.destinationPoint.latitude,
      //   lng2: this.destinationPoint.longitude
      // };
      // newRoute.text = "traseu1";
      // newRoute.value = JSON.stringify(routePoints);
      //this.dropDownElement.appendChild(newRoute);
      // this.dropDownUserElement.appendChild(newRoute);
    }
    this.routeForm.get('name').reset();

    console.log("aici");
    console.log(getAuth());
    // console.log(this.fbs.getChangeFeedList());
  }

  showRouteFromDropdown() {
    let dropDownSelectElement = document.getElementById('routes') as HTMLSelectElement;
    // Assuming dropDownElement is your dropdown element
    if (this.selectedDropDown === "userRoutes") {
      dropDownSelectElement = document.getElementById('userRoutes') as HTMLSelectElement;
    }


    // Get the selected option
    const selectedOption = dropDownSelectElement.options[dropDownSelectElement.selectedIndex];

    // Access the value and text of the selected option
    const selectedValue = selectedOption.value;
    const selectedText = selectedOption.text;

    // Now, you can use selectedValue and selectedText as needed
    console.log('Selected Value:', selectedValue);
    console.log('Selected Text:', selectedText);

    // Parse the JSON string to an object
    var selectedObject = JSON.parse(selectedValue);

    // Access the properties
    var lat1 = selectedObject.lat1;
    var lng1 = selectedObject.lng1;
    var lat2 = selectedObject.lat2;
    var lng2 = selectedObject.lng2;
    var name = selectedText;
    var dist = 0;

    type Review = {
      stars: number;
      text: string;
    };

    var reviews: Array<Review>;
    reviews = selectedObject.reviews;

    var point1 = {
      latitude: lat1,
      longitude: lng1
    };

    var point2 = {
      latitude: lat2,
      longitude: lng2
    };

    var mapPoint1 = new Point(point1);
    var mapPoint2 = new Point(point2);

    this.startPoint = mapPoint1;
    this.destinationPoint = mapPoint2;

    const routeUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";

    this.view.graphics.removeAll();

    const graphic1 = new Graphic({
      symbol: {
        type: "simple-marker",
        color: "white",
        size: "8px"
      } as any,
      geometry: mapPoint1
    });
    this.view.graphics.add(graphic1);

    const graphic2 = new Graphic({
      symbol: {
        type: "simple-marker",
        color: "black",
        size: "8px"
      } as any,
      geometry: mapPoint2
    });
    this.view.graphics.add(graphic2);

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
        // const direction = document.createElement(""); //problem
        // direction.innerHTML = "Directions:";
        // directions.appendChild(direction);
        features.forEach((result: any, i: any) => {
          sum += parseFloat(result.attributes.length);
          const direction = document.createElement("li");
          direction.innerHTML = result.attributes.text + " (" + result.attributes.length + " miles)";
          directions.appendChild(direction);
        });

        sum = sum * 1.609344;
        dist = sum;
        console.log('dist (km) = ', sum);
        this.view.ui.empty("top-right");
        this.view.ui.add(directions, "top-right");
        this.routePopup(name, reviews, dist);
      }
    }).catch((error: any) => {
      console.log(error);
    });
  }

  routePopup(name: string, reviews: any, dist: number) {
    console.log("mda " + dist);
    // Add a click event listener for the point
    this.view.on('pointer-move', (event) => {
      const hoveredPoint = this.view.toMap({ x: event.x, y: event.y });
      // console.log(this.startPoint.longitude.toFixed(2), hoveredPoint.longitude.toFixed(2), this.startPoint.latitude.toFixed(2), hoveredPoint.latitude.toFixed(2));
      if (this.startPoint.longitude.toFixed(2) == hoveredPoint.longitude.toFixed(2) && this.startPoint.latitude.toFixed(2) == hoveredPoint.latitude.toFixed(2)) {
        this.view.popup.dockEnabled = false;
        this.view.openPopup({
          title: name,
          content: `<!DOCTYPE html>
          <html lang="en"><div style="max-width: 300px; padding: 20px; border-radius: 10px; background-color: #f5f5f5; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); font-family: 'Arial', sans-serif;">
          <div style="font-size: 20px; font-weight: bold; color: #333; margin-bottom: 15px;">Starting point of ${name}</div>
          <div style="font-weight: bold; margin-bottom: 5px;">Location:
            <div style="margin-left: 20px;">&nbsp;&nbsp;lat: ${this.startPoint.latitude.toFixed(2)}</div>
            <div style="margin-left: 20px;">&nbsp;&nbsp;lng: ${this.startPoint.longitude.toFixed(2)}</div>
          </div>
          <div style="font-weight: bold; margin-bottom: 5px;">Distance: ${dist.toFixed(2)} km</div>
          <div style="margin-top: 15px; color: #333;" class="popup-reviews">
            <p style="font-weight: bold; margin-bottom: 5px;">Reviews:</p>
            <ul style="list-style: none; padding: 0;">
              ${reviews.map((review, index) => `
                <li style="margin-bottom: 15px;">
                  <span style="font-weight: bold; margin-right: 5px; color: #00897b;">Review ${index + 1}:</span><br>
                  <span style="color: #fbc02d; font-weight: bold;">Rating: ${review.stars} stars</span><br>
                  <span style="color: #666;">"${review.text}"</span>
                </li>
              `).join('')}
            </ul>
          </div>
          <button btn btn-primary (click)="openModuleReview()">Add a review</button>
        </div></>`,
          location: this.startPoint
        });
      } else {
        this.view.closePopup();
        this.view.popup.dockEnabled = true;
      }
      // else {
      //   if (this.destinationPoint.longitude.toFixed(3) == hoveredPoint.longitude.toFixed(3) && this.destinationPoint.latitude.toFixed(3) == hoveredPoint.latitude.toFixed(3))
      //     this.view.openPopup({
      //       title: name,
      //       content: `<div style="max-width: 300px; padding: 20px; border-radius: 10px; background-color: #f5f5f5; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); font-family: 'Arial', sans-serif;">
      //       <div style="font-size: 20px; font-weight: bold; color: #333; margin-bottom: 15px;">Destination point of ${name}</div>
      //       <div style="font-weight: bold; margin-bottom: 5px;">Location:
      //         <div style="margin-left: 20px;">&nbsp;&nbsp;lat: ${this.destinationPoint.latitude.toFixed(3)}</div>
      //         <div style="margin-left: 20px;">&nbsp;&nbsp;lng: ${this.destinationPoint.longitude.toFixed(3)}</div>
      //       </div>
      //       <div style="margin-top: 15px; color: #333;" class="popup-reviews">
      //         <p style="font-weight: bold; margin-bottom: 5px;">Reviews:</p>
      //         <ul style="list-style: none; padding: 0;">
      //           ${reviews.map((review, index) => `
      //             <li style="margin-bottom: 15px;">
      //               <span style="font-weight: bold; margin-right: 5px; color: #00897b;">Review ${index + 1}:</span><br>
      //               <span style="color: #fbc02d; font-weight: bold;">Rating: ${review.stars} stars</span><br>
      //               <span style="color: #666;">"${review.text}"</span>
      //             </li>
      //           `).join('')}
      //         </ul>
      //       </div>
      //     </div>`,
      //       location: this.destinationPoint
      //     });

      //   }       else {
      //     this.view.closePopup();
      // }
    });
  }

  openModalReview() {
    this.matDialog.open(ReviewComponent, {
      "width": '600px',
      "maxHeight": '90vh',
      "data": "John",
      "autoFocus": false
    });
  }

  disconnectFirebase() {
    if (this.subscriptionList != null) {
      this.subscriptionList.unsubscribe();
    }
    if (this.subscriptionObj != null) {
      this.subscriptionObj.unsubscribe();
    }
  }

  addRoutesInDropdown(userRoutes: Array<IRouteItem>, type: string) {
    for (let i = 0; i < userRoutes.length; i++) {
      const newRoute = document.createElement("option");
      const routePoints = {
        lat1: userRoutes[i].lat1,
        lng1: userRoutes[i].lng1,
        lat2: userRoutes[i].lat2,
        lng2: userRoutes[i].lng2,
        reviews: userRoutes[i].reviews,
        user: userRoutes[i].user
      };
      newRoute.text = userRoutes[i].name;
      newRoute.value = JSON.stringify(routePoints);
      if (type === "user")
        this.dropDownUserElement.appendChild(newRoute);
      else if (type === "all")
        this.dropDownElement.appendChild(newRoute);
    }
  }

  ngOnInit() {
    // Initialize MapView and return an instance of MapView
    console.log("initializing map");
    console.log(this.authService);

    this.createRouteForm();

    let routes = [];
    this.dropDownElement = document.getElementById("routes");

    let userRoutes = [];
    this.dropDownUserElement = document.getElementById("userRoutes");
    this.fbs.extractUserRoutes().subscribe(data => {

      while (this.dropDownUserElement.hasChildNodes()) {
        this.dropDownUserElement.removeChild(this.dropDownUserElement.firstChild);
      }
      userRoutes = data.filter((route: any) => route.user === this.authService.userData.uid);
      this.addRoutesInDropdown(userRoutes, "user");
      console.log(userRoutes);

      while (this.dropDownElement.hasChildNodes()) {
        this.dropDownElement.removeChild(this.dropDownElement.firstChild);
      }
      routes = data;
      this.addRoutesInDropdown(routes, "all");
      console.log(routes);
    });
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

  createRouteForm() {
    this.routeForm = new FormGroup({
      name: new FormControl('', Validators.required),
      //password: new FormControl('', Validators.required)
    })
  }

}



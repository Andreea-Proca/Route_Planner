import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  OnDestroy
} from "@angular/core";

import esri = __esri; // Esri TypeScript Types

import { Subscription } from "rxjs";
import { FirebaseService, IRouteItem, ITestItem, IPoint } from "src/app/services/database/firebase";
import { getAuth } from "firebase/auth";
import Config from '@arcgis/core/config';
import WebMap from '@arcgis/core/WebMap';
import MapView from '@arcgis/core/views/MapView';

import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';

import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import RouteParameters from '@arcgis/core/rest/support/RouteParameters';
import * as route from "@arcgis/core/rest/route.js";

import Search from '@arcgis/core/widgets/Search.js';
import Locate from "@arcgis/core/widgets/Locate.js";
import Compass from "@arcgis/core/widgets/Compass.js";
import Fullscreen from "@arcgis/core/widgets/Fullscreen.js";
import Sketch from "@arcgis/core/widgets/Sketch.js"

import * as locator from "@arcgis/core/rest/locator.js";
import WebStyleSymbol from '@arcgis/core/symbols/WebStyleSymbol';
import { AuthService } from "src/app/services/auth";

import { FormControl, FormGroup, Validators } from "@angular/forms";
import Legend from '@arcgis/core/widgets/Legend';

import LayerList from "@arcgis/core/widgets/LayerList.js";
import { MatDialog } from '@angular/material/dialog';
import { ReviewComponent } from "../review/review.component";
import { RoutingServiceComponent } from "../routing-service/routing-service.component";

import * as webMercatorUtils from "@arcgis/core/geometry/support/webMercatorUtils";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import Polyline from "@arcgis/core/geometry/Polyline";

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
  zoom = 7;
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
  sketchWidget: Sketch;

  routeForm: FormGroup;
  legendOn: boolean = true;
  layerOn = true;
  layerList: LayerList;
  routeClickCounter: boolean = false;
  isButtonVisible: boolean = false;
  routeGraphic: any;
  routeName: string;

  eventHandler: IHandle;

  constructor(
    private authService: AuthService,
    private fbs: FirebaseService,
    private matDialog: MatDialog
  ) { }

  async initializeMap() {
    try {
      // Configure the Map
      const mapProperties: esri.WebMapProperties = {
        portalItem: {
          id: "6f90bddf9cec4e81aee4e2dcefe7169d"
        }
      };
      Config.apiKey = "AAPKba863a01015c4ac0abf7e38b281f64604o_R5CzYPymg8lQ_DGiRpc00YTXy2pGxe7YsZUU3LmcxW9xrS0eQgEzDywhaJeiP";

      this.map = new WebMap(mapProperties);
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
        view: this.view
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

      // create a new sketch widget
      this.sketchWidget = new Sketch({
        view: this.view,
        layer: this.graphicsLayer
      });
      this.view.ui.add(this.sketchWidget, {
        position: "top-right",
        index: 0
      });

      if (this.sketchWidget != null) {
        this.sketchWidget.on('create', (event) => {
          if (event.state === 'complete') {
            this.routeGraphic = event.graphic;
          }
        });
      }

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

      this.view.when(() => {
        console.log("ArcGIS map loaded");
        console.log("Map center: " + this.view.center.latitude + ", " + this.view.center.longitude);
      });

      this.view.on('pointer-move', ["Shift"], (event) => {
        let point = this.view.toMap({ x: event.x, y: event.y });
        console.log("map moved: ", point.longitude, point.latitude);
      });

      await this.view.when(); // wait for map to load
      console.log("ArcGIS map loaded");
      console.log("Map center: " + this.view.center.latitude + ", " + this.view.center.longitude);
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
        y: y
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
      location: pt,
      outFields: ["PlaceName", "Place_addr"]
    }

    locator.addressToLocations(geocodingServiceUrl, params).then((results) => {
      for (let item of results) {
        this.addIcon(item.location.latitude, item.location.longitude, true, icon)
      }
      console.log(results)
    });
  }

  addGraphicLayers() {
    this.graphicsLayer = new GraphicsLayer();
    this.map.add(this.graphicsLayer);
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
      this.layerList.operationalItems.forEach(layerListItem => {
        if (layerListItem.title === name) {
          desiredLayer = layerListItem.layer;
        }
      });
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
    var points = new Array<IPoint>;
    console.log("graphic:", this.routeGraphic.geometry.paths);
    var paths = this.routeGraphic.geometry.paths[0];
    for (let i = 0; i < paths.length; i++) {
      let point = {
        latitude: paths[i][1],
        longitude: paths[i][0]
      };

      var geoPoint = webMercatorUtils.webMercatorToGeographic(new Point(point)) as __esri.Point;
      let iPoint: IPoint = {
        x: geoPoint.longitude,
        y: geoPoint.latitude
      }
      console.log("iPoint: ", iPoint);
      points.push(iPoint);
    }

    if (this.routeForm.value.name != '') {
      this.fbs.addRouteItem(points, this.routeForm.value.name, this.authService.userData.uid);

    }
    this.routeForm.get('name').reset();

    console.log("aici");
    console.log(getAuth());
    var button = document.getElementById('setActive');
    if (button) {
      button.style.display = 'none';
    }
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

    var points: Array<IPoint>;
    points = selectedObject.points;

    this.view.graphics.removeAll();

    var esriPoints = points.map(latLong => {
      return new Point({
        longitude: latLong.x,
        latitude: latLong.y
      });
    });

    var polyline = new Polyline({
      paths: [esriPoints.map(point => [point.longitude, point.latitude])]
    });

    const graphic = new Graphic({
      symbol: new SimpleLineSymbol({
        color: "blue",
        width: 4
      }),
      geometry: polyline
    });
    this.view.graphics.add(graphic);

    for (let i = 0; i < esriPoints.length; i++) {
      const graphic = new Graphic({
        symbol: {
          type: "simple-marker",
          color: "white",
          size: "10px"
        } as any,
        geometry: esriPoints[i]
      });
      this.view.graphics.add(graphic);
      if (i == 0)
        this.startPoint = esriPoints[i];
      if (i == esriPoints.length - 1)
        this.destinationPoint = esriPoints[i];
    }

    type Review = {
      stars: number;
      text: string;
    };

    var reviews: Array<Review>;
    reviews = selectedObject.reviews;
    console.log(selectedText, reviews);
    this.routeName = selectedText;
    this.routePopup(selectedText, reviews, 0);
  }

  drawRouteSteps() {
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

    var points: Array<IPoint>;
    points = selectedObject.points;

    // this.view.graphics.removeAll();
    var esriPoints = points.map(latLong => {
      return new Point({
        longitude: latLong.x,
        latitude: latLong.y
      });
    });

    for (let i = 0; i < esriPoints.length - 1; i++) {
      this.getRoutePart(selectedText, esriPoints[i], esriPoints[i + 1], selectedObject.reviews);
    }
  }

  getRoutePart(name: string, mapPoint1: Point, mapPoint2: Point, rev: any) {
    // let dropDownSelectElement = document.getElementById('routes') as HTMLSelectElement;
    // // Assuming dropDownElement is your dropdown element
    // if (this.selectedDropDown === "userRoutes") {
    //   dropDownSelectElement = document.getElementById('userRoutes') as HTMLSelectElement;
    // }

    // // Get the selected option
    // const selectedOption = dropDownSelectElement.options[dropDownSelectElement.selectedIndex];

    // // Access the value and text of the selected option
    // const selectedValue = selectedOption.value;
    // const selectedText = selectedOption.text;

    // // Now, you can use selectedValue and selectedText as needed
    // console.log('Selected Value:', selectedValue);
    // console.log('Selected Text:', selectedText);

    // // Parse the JSON string to an object
    // var selectedObject = JSON.parse(selectedValue);

    // // Access the properties
    // var lat1 = selectedObject.lat1;
    // var lng1 = selectedObject.lng1;
    // var lat2 = selectedObject.lat2;
    // var lng2 = selectedObject.lng2;
    //var name = selectedText;
    var dist = 0;

    // type Review = {
    //   stars: number;
    //   text: string;
    // };

    // var reviews: Array<Review>;
    // reviews = rev.reviews;

    // var point1 = {
    //   latitude: lat1,
    //   longitude: lng1
    // };

    // var point2 = {
    //   latitude: lat2,
    //   longitude: lng2
    // };

    // var mapPoint1 = new Point(point1);
    // var mapPoint2 = new Point(point2);

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
        color: "white",
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
        //this.routePopup(name, reviews, dist);
      }
    }).catch((error: any) => {
      console.log(error);
    });
  }

  createPopupContent(reviews: any, name: string, dist: number) {
    const container = document.createElement('div');
    const htmlContent = `<!DOCTYPE html>
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
      ${reviews?.map((review, index) => `
      <li style="margin-bottom: 15px;">
        <span style="font-weight: bold; margin-right: 5px; color: #00897b;">Review ${index + 1}:</span><br>
        <span style="color: #fbc02d; font-weight: bold;">Rating: ${review.stars} stars</span><br>
        <span style="color: #666;">"${review.text}"</span>
      </li>
    `).join('')}
      </ul>
    </div>
  </div>`;

    container.innerHTML = htmlContent;
    var button = document.createElement('button');
    button.innerHTML = `<div> Add a review </div>`;
    button.className = 'esri-widget--button esri-widget esri-interactive';
    // Set width and height using style properties
    button.style.width = '150px'; // Set the desired width
    button.style.height = '40px'; // Set the desired height
    button.style.padding = '5px';
    button.style.fontSize = '16px';
    button.style.marginTop = '10px';
    button.style.marginLeft = '90px';
    button.style.color = 'white';
    button.style.backgroundColor = 'purple';
    button.style.border = '2px solid black';
    button.style.borderRadius = '5px';

    button.addEventListener('click', () => { this.openModalReview() });
    container.appendChild(button);

    var button1 = document.createElement('button');
    button1.innerHTML = `<div> Use routing service </div>`;
    button1.className = 'esri-widget--button esri-widget esri-interactive';
    // Set width and height using style properties
    button1.style.width = '150px'; // Set the desired width
    button1.style.height = '40px'; // Set the desired height
    button1.style.padding = '5px';
    button1.style.fontSize = '16px';
    button1.style.marginTop = '10px';
    button1.style.marginLeft = '90px';
    button1.style.color = 'white';
    button1.style.backgroundColor = 'blue';
    button1.style.border = '2px solid black';
    button1.style.borderRadius = '5px';
    button1.addEventListener('click', () => { this.openModalRouting() });
    container.appendChild(button1);
    return container;
  }
  routePopup(name: string, reviews: any, dist: number) {
    if (this.eventHandler) {
      this.eventHandler.remove();
      this.eventHandler = null;
    }
    this.eventHandler = this.view.on('pointer-move', (event) => {
      const hoveredPoint = this.view.toMap({ x: event.x, y: event.y });
      if (this.startPoint.longitude.toFixed(2) == hoveredPoint.longitude.toFixed(2) && this.startPoint.latitude.toFixed(2) == hoveredPoint.latitude.toFixed(2)) {
        this.view.popup.dockEnabled = false;
        this.view.openPopup({
          title: name,
          content: this.createPopupContent(reviews, name, dist),
          location: this.startPoint
        });
      } else {
        this.view.closePopup();
        this.view.popup.dockEnabled = true;
      }
    });
  }

  openModalReview() {
    this.matDialog.open(ReviewComponent, {
      "width": '600px'
    });
  }

  openModalRouting() {
    this.matDialog.open(RoutingServiceComponent, {
      "width": '1000px',
      "height": '600px',
      data: {
        name: this.routeName,
        startPoint: this.startPoint,
        destinationPoint: this.destinationPoint
      }
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
        points: userRoutes[i].points,
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

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      console.log("key enter works");
      var button = document.getElementById('setActive');
      if (button) {
        button.style.display = 'block';
      }
    }
  }

  ngOnInit() {
    // Initialize MapView and return an instance of MapView
    console.log("initializing map");
    console.log(this.authService);

    document.addEventListener('keydown', this.handleKeyDown.bind(this));

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
    });
  }

  ngOnDestroy() {
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
    if (this.view) {
      // destroy the map view
      this.view.container = null;
    }
    this.disconnectFirebase();
  }

  createRouteForm() {
    this.routeForm = new FormGroup({
      name: new FormControl('', Validators.required)
    })
  }
}

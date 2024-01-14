import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  OnDestroy,
  Inject
} from "@angular/core";

import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FirebaseService } from "src/app/services/database/firebase";
import Config from '@arcgis/core/config';
import WebMap from '@arcgis/core/WebMap';

import esri = __esri; // Esri TypeScript Types
import MapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from '@arcgis/core/geometry/Point';
import RouteParameters from "@arcgis/core/rest/support/RouteParameters";
import * as route from "@arcgis/core/rest/route";
import FeatureSet from "@arcgis/core/rest/support/FeatureSet";
import Compass from "@arcgis/core/widgets/Compass";
import Locate from "@arcgis/core/widgets/Locate";
import Search from "@arcgis/core/widgets/Search";

@Component({
  selector: 'app-routing-service',
  templateUrl: './routing-service.component.html',
  styleUrls: ['./routing-service.component.scss']
})
export class RoutingServiceComponent implements OnInit, OnDestroy {
  // The <div> where we will place the map
  @ViewChild("mapViewNode", { static: true }) private mapViewEl: ElementRef;

  constructor(
    private fbs: FirebaseService,
    @Inject(MAT_DIALOG_DATA) public anyVariable,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) { }

  // Instances
  map: esri.Map;
  view: esri.MapView;
  pointGraphic: esri.Graphic;
  graphicsLayer: esri.GraphicsLayer;
  zoom = 7;
  center: Array<number> = [25.009431, 45.944286];
  searchWidget: Search;
  compassWidget: Compass;
  locateWidget: Locate;

  ngOnInit() {
    this.initializeMap();
  }

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
      this.graphicsLayer = new GraphicsLayer();
      this.map.add(this.graphicsLayer);

      // Initialize the MapView
      const mapViewProperties = {
        container: this.mapViewEl.nativeElement,
        center: this.center,
        zoom: this.zoom,
        map: this.map
      };

      this.view = new MapView(mapViewProperties);

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

      this.view.on('pointer-move', ["Shift"], (event) => {
        let point = this.view.toMap({ x: event.x, y: event.y });
        console.log("map moved: ", point.longitude, point.latitude);
      });

      this.getRoutePart();
      await this.view.when(); // wait for map to load
      console.log("ArcGIS map loaded");
      console.log("Map center: " + this.view.center.latitude + ", " + this.view.center.longitude);
      return this.view;
    } catch (error) {
      console.log("EsriLoader: ", error);
    }
  }

  ngOnDestroy(): void {
    if (this.view) {
      // destroy the map view
      this.view.container = null;
    }
  }

  getRoutePart() {
    var mapPoint1 = this.data.startPoint;
    var mapPoint2 = this.data.destinationPoint;
    var name = this.data.routeName;

    var dist = 0;
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
        //this.routePopup(name, reviews, dist);
      }
    }).catch((error: any) => {
      console.log(error);
    });
  }
}

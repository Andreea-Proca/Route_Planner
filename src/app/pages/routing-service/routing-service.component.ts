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

@Component({
  selector: 'app-routing-service',
  templateUrl: './routing-service.component.html',
  styleUrls: ['./routing-service.component.scss']
})
export class RoutingServiceComponent implements OnInit, OnDestroy {
  // The <div> where we will place the map
  @ViewChild("mapViewNode1", { static: true }) private mapViewEl: ElementRef;

  constructor(
    private fbs: FirebaseService,
    @Inject(MAT_DIALOG_DATA) public anyVariable
  ) { }

  // Instances
  map: esri.Map;
  view: esri.MapView;
  pointGraphic: esri.Graphic;
  graphicsLayer: esri.GraphicsLayer;
  zoom = 7;
  center: Array<number> = [25.009431, 45.944286];

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

  ngOnDestroy(): void {
    throw new Error("Method not implemented.");
  }
}

// Copyright (c) 2017 Luke San Antonio Bialecki
// All rights reserved

// Released under the BSD 2-Clause license
"use strict";

import "babel-polyfill";

import polyline from '@mapbox/polyline';

function rgb_from_hsv(h, s, v) {
  const h_i = Math.floor(h * 6);
  const f = h * 6 - h_i;
  const p = v * (1 - s)
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  if(h_i == 0) {
    return new Cesium.Color(v, t, p);
  }
  if(h_i == 1) {
    return new Cesium.Color(q, v, p);
  }
  if(h_i == 2) {
    return new Cesium.Color(p, v, t);
  }
  if(h_i == 3) {
    return new Cesium.Color(p, q, t);
  }
  if(h_i == 4) {
    return new Cesium.Color(t, p, v);
  }
  if(h_i == 5) {
    return new Cesium.Color(v, p, q);
  }
}

const ONE_OVER_GOLDEN_RATIO = 0.618033988749895

//! Given the previous hue, return a new one.
function generate_random_hue(prev_hue) {
  // This keeps only the fractional part (ie 5.2 => 0.2)
  // It creates pretty even distribution of values in our range from
  // 0.0 to 1.0
  return (prev_hue + ONE_OVER_GOLDEN_RATIO) % 1;
}

function lock_camera(scene) {
  scene.screenSpaceCameraController.enableRotate = false;
  scene.screenSpaceCameraController.enableTranslate = false;
  scene.screenSpaceCameraController.enableZoom = false;
  scene.screenSpaceCameraController.enableTilt = false;
  scene.screenSpaceCameraController.enableLook = false;
}

function free_camera(scene) {
  scene.screenSpaceCameraController.enableRotate = true;
  scene.screenSpaceCameraController.enableTranslate = true;
  scene.screenSpaceCameraController.enableZoom = true;
  scene.screenSpaceCameraController.enableTilt = true;
  scene.screenSpaceCameraController.enableLook = true;
}

const ENABLE_LIGHTING = false;

const terrainProvider = new Cesium.CesiumTerrainProvider({
  url: "https://assets.agi.com/stk-terrain/v1/tilesets/world/tiles",
  requestVertexNormals: ENABLE_LIGHTING,
});

const imageryProvider = new Cesium.BingMapsImageryProvider({
  //###########################################!!
  // Please change this if you use this code!! !!
  //###########################################!!
  key: "AkevzLEMA6Tu0xpf9YHQiqQ6VWiPNIeBnbcFcoubPaigNjmgw4ANWs5AYK4ysqZR",
  url: "https://dev.virtualearth.net",
  mapStyle: "AERIAL",
});

var viewer = new Cesium.Viewer('cesiumContainer', {
  imageryProvider: imageryProvider,
  terrainProvider: terrainProvider,
  baseLayerPicker: false,
  selectionIndicator: false,
});

viewer.scene.globe.enableLighting = ENABLE_LIGHTING;

viewer.infoBox.frame.addEventListener('load', function() {
  // Once the info box frame loads, inject our CSS.
  var style_link = document.createElement("link");
  style_link.rel = "stylesheet";
  style_link.type = "text/css";
  style_link.href = "/static/main.css";
  viewer.infoBox.frame.contentDocument.head.appendChild(style_link);
});

import strava from 'strava-v3';

function strava_promise(resolve, reject) {
  return function(err, payload, limits) {
    if(payload) {
      resolve(payload);
    } else {
      reject(payload);
    }
  }
}

function get_activities_page(access, page_i) {
  // Create a promise that yields a specific page of an athletes activities
  return new Promise(function(resolve, reject) {
    strava.athlete.listActivities({
      access_token: access,
      page: page_i,
      per_page: 200,
    }, strava_promise(resolve, reject));
  });
}

function get_activity(access, params) {
  return new Promise(function(resolve, reject) {
    strava.activities.get({
      access_token: access,
      ...params
    }, strava_promise(resolve, reject));
  });
}

function map_activities(activities) {
  var obj = {};
  for(var i = 0; i < activities.length; ++i) {
    obj[activities[i].id] = activities[i];
  }
  return obj;
}

async function polyline_positions(activity, sample_terrain)
{
  var activity_polyline = activity.map.summary_polyline;
  if(activity.map.polyline) {
    activity_polyline = activity.map.polyline;
    if(!sample_terrain) {
      // Default for detailed polylines
      sample_terrain = true;
    }
  } else {
    if(!sample_terrain) {
      sample_terrain = false;
    }
  }

  if(!activity_polyline) {
    // Bad polyline, the activity might not support one. Make a thing with no
    // points.
    return [];
  }

  var pts = polyline.decode(activity_polyline);
  var cartos = []
  for(var i = 0; i < pts.length; ++i) {
    var carto = new Cesium.Cartographic.fromDegrees(pts[i][1], pts[i][0]);
    cartos.push(carto);
  }
  // Add heights if we want a detailed repr.
  if(sample_terrain) {
    await Cesium.sampleTerrainMostDetailed(terrainProvider, cartos);
  }

  // Convert
  return viewer.scene.globe.ellipsoid.cartographicArrayToCartesianArray(cartos);
}

import React from 'react';
import ReactDOM from 'react-dom';

class ActivitiesSelectionView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activities: {},
      page_i: 0,
      sorted_activities: [],
    };

    // This will map strava activity ids to cesium entities.
    this.entities = {};
    this.hue = Math.random();
    this.cur_shown = null;

    this.onActivityClick = this.onActivityClick.bind(this);
  }

  async _flyToActivity(id) {
    if(this.cur_shown) {
      this.cur_shown.show = false;
    }

    // Unselect whatever is currently selected
    // Select the new entity
    viewer.selectedEntity = this.entities[id];
    this.props.cesiumViewer.flyTo(this.entities[id], {
      duration: 1.0,
    });

    this.cur_shown = this.entities[id];
    this.cur_shown.show = true;

    // Make a request for the detailed polyline of this entity.
    var activity = await get_activity(this.props.accessToken, {
      id,
      include_all_efforts: true,
    });

    // Update the activity and update the entity polyline.
    var positions = await polyline_positions(activity);

    this.entities[id].polyline.positions = positions;

    // Don't bother re-rendering, since the information should by and large be
    // the same. Maybe at some point in the future we'll change the way we
    // render detailed activities, but right now it's not important.
    this.state.activities[id] = activity;
  }

  async _buildActivityEntity(activity) {
    // Make a new entity for each activity
    if(!this.entities.hasOwnProperty(activity.id)) {
      // Get the activities polyline.
      var polyline = await polyline_positions(activity);
      // Make sure a polyline actually exists first.
      if(polyline.length == 0) {
        // Do this so subsequent calls return null also.
        this.entities[activity.id] = null;
        return null;
      }

      // Generate a new, random hue
      this.hue = generate_random_hue(this.hue);

      const entity = {
        id: activity.id,
        name: activity.name,
        description: activity.description || "No description available",
        show: false,
        polyline: {
          positions: polyline,
          width: 5,
          material: rgb_from_hsv(this.hue, .5, .95)
        }
      };
      this.entities[activity.id] = this.props.cesiumViewer.entities.add(entity);
    }
    return this.entities[activity.id];
    // Make a query for the detailed activity at some point so we get the more
    // detailed polyline.
  }

  async _requestNextActivities() {
    if(this.state.page_i < 0) {
      // No more activities to retrieve.
      return;
    }

    // Start the query for the next page of activites
    var activities = await get_activities_page(
      this.props.accessToken, this.state.page_i
    );

    var new_page_i = this.state.page_i;
    if(activities.length > 0) {
      // There are potentially more pages
      new_page_i += 1;
    } else {
      // No pages left
      new_page_i = -1;
    }

    // Build those activities into cesium entities
    activities.map((x) => { this._buildActivityEntity(x) });

    // Add our new activities to the end of the list
    const new_activities = Object.assign(this.state.activities,
                                         map_activities(activities));

    // Make a list of activities sorted by date
    var sorted_activities = Object.values(new_activities).sort((lhs, rhs) => {
      return new Date(rhs.start_date) - new Date(lhs.start_date);
    });

    this.setState({
      page_i: new_page_i,
      activities: new_activities,
      sorted_activities: sorted_activities,
    });
  }

  async componentDidMount() {
   this._requestNextActivities()
  }
  async componentDidUpdate() {
    this._requestNextActivities()
  }
  async onActivityClick(e) {
    e.preventDefault();

    if(e.target.value == "free") {
      free_camera(viewer.scene);
      return;
    }

    lock_camera(viewer.scene);
    await this._flyToActivity(e.target.value);
  }
  render() {
    const icon_class_mapping = {
      'Ride': 'fa-bicycle',
      'Run': 'fa-smile-o',
    }
    var options = [<option key="0" value="free">Free camera</option>]
    for(var i = 0; i < this.state.sorted_activities.length; ++i) {
      const activity = this.state.sorted_activities[i];
      const icon_class = icon_class_mapping[activity.type];

      options.push(
        <option key={activity.id} value={activity.id}>{activity.name}</option>
      );
    }
    return <select className="cesium-button" onChange={this.onActivityClick}>
      {options}
    </select>
  }
}

ReactDOM.render(
  <ActivitiesSelectionView accessToken={AccessToken} cesiumViewer={viewer} />,
  document.getElementById('toolbar')
)

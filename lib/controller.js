// Copyright (c) 2017 Luke San Antonio Bialecki
// All rights reserved

// Released under the BSD 2-Clause license

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

var viewer = new Cesium.Viewer('cesiumContainer', {
  imageryProvider: Cesium.createOpenStreetMapImageryProvider(),
  baseLayerPicker: false,
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

function map_activities(activities) {
  var obj = {};
  for(var i = 0; i < activities.length; ++i) {
    obj[activities[i].id] = activities[i];
  }
  return obj;
}

function polyline_positions(activity)
{
  var activity_polyline = activity.map.summary_polyline;
  if(activity.map.polyline) {
    activity_polyline = activity.map.polyline;
  }

  if(!activity_polyline) {
    // Bad polyline, the activity might not support one. Make a thing with no
    // points.
    return [];
  }

  var pts = polyline.decode(activity_polyline);
  var poly = []
  for(var i = 0; i < pts.length; ++i) {
    poly.push(pts[i][1]);
    poly.push(pts[i][0]);
  }

  return poly;
}

import React from 'react';
import ReactDOM from 'react-dom';

class ActivitiesSelectionView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activities: [],
      page_i: 0,
    };

    // This will map strava activity ids to cesium entities.
    this.entities = {};
    this.hue = Math.random();
    this.cur_shown = null;

    this.onActivityClick = this.onActivityClick.bind(this);
  }

  _flyToActivity(id) {
    if(this.cur_shown) {
      this.cur_shown.show = false;
    }
    this.props.cesiumViewer.flyTo(this.entities[id]);
    this.cur_shown = this.entities[id];
    this.cur_shown.show = true;
  }

  _buildActivityEntity(activity) {
    // Make a new entity for each activity
    if(!this.entities.hasOwnProperty(activity.id)) {
      // Get the activities polyline.
      var polyline_degs = polyline_positions(activity);
      // Make sure a polyline actually exists first.
      if(polyline_degs.length == 0) {
        // Do this so subsequent calls return null also.
        this.entities[activity.id] = null;
        return null;
      }

      // Generate a new, random hue
      this.hue = generate_random_hue(this.hue);

      const entity = {
        id: activity.id,
        show: false,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(polyline_degs),
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

  _requestNextActivities() {
    if(this.state.page_i < 0) {
      // No more activities to retrieve.
      return;
    }

    // Start the query for the next page of activites
    var next_activities = get_activities_page(
      this.props.accessToken, this.state.page_i
    );

    next_activities.then(activities => {
      var new_page_i = this.state.page_i;
      if(activities.length > 0) {
        // There are potentially more pages
        new_page_i += 1;
      } else {
        // No pages left
        new_page_i = -1;
      }

      // Build those activities into cesium entities
      activities.map((x) => this._buildActivityEntity(x));

      // Add our new activities to the end of the list
      const new_activities = Object.assign(this.state.activities,
                                           map_activities(activities));
      this.setState({
        page_i: new_page_i,
        activities: new_activities,
      });
    });
  }

  async componentDidMount() {
   this._requestNextActivities()
  }
  async componentDidUpdate() {
    this._requestNextActivities()
  }
  onActivityClick(e) {
    e.preventDefault();

    this._flyToActivity(e.currentTarget.dataset.activityId);
  }
  render() {
    const icon_class_mapping = {
      'Ride': 'fa-bicycle',
      'Run': 'fa-smile-o',
    }
    var lis = []
    for(var activity_id in this.state.activities) {
      if(!this.state.activities.hasOwnProperty(activity_id)) {
        continue;
      }

      const activity = this.state.activities[activity_id];
      const icon_class = icon_class_mapping[activity.type];

      lis.push(
        <li key={activity_id}>
          <a href="#"
             onClick={this.onActivityClick}
             data-activity-id={activity_id} >
            <i className={"fa fa-fw " + icon_class} aria-hidden="true">
            </i>
            &nbsp;
            <div className="activity-info" >
              <p className="activity-title">{activity.name}</p>
              <div className="activity-detail">
                <p className="activity-date">{activity.start_date_local}</p>
                <p className="activity-distance">Distance: {activity.distance} Meters</p>
                <p className="activity-elevation">Elevation Gain: {activity.total_elevation_gain} Meters</p>
              </div>
            </div>
          </a>
        </li>
      );
    }
    return <ul>{lis}</ul>
  }
}

ReactDOM.render(
  <ActivitiesSelectionView accessToken={AccessToken} cesiumViewer={viewer} />,
  document.getElementById('activities')
)

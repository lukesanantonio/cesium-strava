// Copyright (c) 2017 Luke San Antonio Bialecki
// All rights reserved

// Released under the BSD 2-Clause license

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

var viewer = new Cesium.Viewer('cesiumContainer', {
  imageryProvider: Cesium.createOpenStreetMapImageryProvider(),
  baseLayerPicker: false,
});

var lines = []
var MAX_HEIGHT = 500.0;
var height = 0.0;
for(var i = 0; i < Polylines.length; ++i) {
  if(Polylines[i] == null) {
    continue;
  }
  // [[], [], []]
  var pts = polyline.decode(Polylines[i].polyline);
  var pl = [];
  for(var j = 0; j < pts.length; ++j) {
    // Push longitude first
    pl.push(pts[j][1]);
    // Then latitude
    pl.push(pts[j][0]);
    // Then height
    pl.push(height);
  }
  lines.push(pl);

  height += MAX_HEIGHT / Polylines.length;
}

var h = Math.random();
var last_entity = null;
for(var i = 0; i < lines.length; ++i) {
  last_entity = viewer.entities.add({
    name: "Path " + i,
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights(lines[i]),
      width: 5,
      material: rgb_from_hsv(h, .5, .95)
    }
  });
  // This keeps only the fractional part (ie 5.2 => 0.2)
  // It creates pretty even distribution of values in our range from
  // 0.0 to 1.0
  h = (h + ONE_OVER_GOLDEN_RATIO) % 1
}

viewer.flyTo(last_entity).then(function(){console.log('hello');});

import React from 'react';
import ReactDOM from 'react-dom';

ReactDOM.render(
  <h1>Hello World</h1>,
  document.getElementById('root')
)

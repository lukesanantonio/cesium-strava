// Copyright (c) 2017 Luke San Antonio Bialecki
// All rights reserved

// Released under the BSD 2-Clause license

var express = require('express');
var path = require('path');

var app = express();

app.set('view engine', 'pug')

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/', express.static(__dirname))

app.listen(8080, function() {
  console.log('Cesium-strava is now listening on 8080');
})

// Copyright (c) 2017 Luke San Antonio Bialecki
// All rights reserved

// Released under the BSD 2-Clause license

var express = require('express');
var path = require('path');
var strava = require('strava-v3');

process.on('unhandledRejection', function(reason, p) {
  console.log(reason);
  process.exit(1);
});

var app = express();

app.set('view engine', 'pug')

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.get('/', function(req, res) {
  var token = req.query.access_token;
  if(token) {
    res.render('index', {
      user_authorized: true,
      access_token: token,
    });
  } else {
    res.render('index', { user_authorized: false });
  }
});

app.get('/strava_auth', function(req, res) {
  const code = req.query.code;

  // Make a promise to get that access token eventually
  var access = new Promise(function(resolve, reject) {
    strava.oauth.getToken(code, function(err, payload, limits) {
      if(payload) {
        // If we received something back
        resolve(payload.access_token);
      } else if(err) {
        reject(err);
      }
    });
  });

  // Redirect the user back but this time providing the access token
  access.then(function(access_token) {
    console.log('Successfully authenticated');
    res.redirect('/?access_token=' + access_token);
  }).catch(function(err) {
    console.log("error: " + err);
    res.send(err);
  });
});

app.listen(8080, function() {
  console.log('Cesium-strava is now listening on 8080');
})

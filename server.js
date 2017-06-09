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
app.use('/lib', express.static(path.join(__dirname, 'lib')));
app.get('/', function(req, res) {
  var user_authd = false;
  if(req.query.access_token) {
    user_authd = true;
    // Find user activities
    var activities = new Promise(function(resolve, reject) {
      strava.athlete.listActivities({ access_token: req.query.access_token },
      function(err, payload, limits) {
        if(payload) {
          resolve(payload)
        } else {
          reject(err)
        }
      });
    });

    activities.then(function(activities) {
      // Find polylines
      polylines = []
      for(var i = 0; i < activities.length; ++i) {
        polylines.push(activities[i].map.summary_polyline);
      }
      return polylines;
    }).then(function(polylines) {
      var params = {
        user_authorized: true,
        polylines: JSON.stringify(polylines),
      }
      res.render('index', params);
    }).catch(function(err) {
      console.log(err);
    });
  }
  else {
    res.render('index', {user_authorized: user_authd});
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
    res.redirect('/?access_token=' + access_token)
  }).catch(function(err) {
    res.send(err);
  });
});

app.listen(8080, function() {
  console.log('Cesium-strava is now listening on 8080');
})

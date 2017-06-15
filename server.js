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
  var token = req.get('Authorization');
  if(token !== null) {
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
        const id = activities[i].id;
        var pl = activities[i].map.summary_polyline;

        // Ignore activities with no polyline
        if(pl == null) continue;

        // Push the id and polyline as an object because we won't ever need to
        // access the polyline by ID, we just want the ID of the activity
        // available so we can query the strava API for a detailed
        // representation.
        polylines.push({id: id, polyline: pl});
      }
      return polylines;
    }).then(function(polylines) {
      var params = {
        user_authorized: true,
        // Turn the object into JSON, which is valid javascript! We'll be
        // putting it right into a <script> tag so this ensures there is no
        // code, etc.
        polylines: JSON.stringify(polylines),
      }
      res.render('index', params);
    }).catch(function(err) {
      console.log(err);
    });
  }
  else {
    res.render('index', {user_authorized: false, polylines: "[]"});
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
    res.header('Authorization', access_token);
    console.log('Successfully authenticated');
    res.redirect('/');
  }).catch(function(err) {
    res.send(err);
  });
});

app.listen(8080, function() {
  console.log('Cesium-strava is now listening on 8080');
})

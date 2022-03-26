// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-workspace
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const loopback = require('loopback');
const boot = require('loopback-boot');

const app = module.exports = loopback();

app.start = function () {
   // start the web server
   return app.listen(function () {
      app.emit('started');
      const baseUrl = app.get('url').replace(/\/$/, '');
      console.log('Web server listening at: %s', baseUrl);
      if (app.get('loopback-component-explorer')) {
         const explorerPath = app.get('loopback-component-explorer').mountPath;
         console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
      }
   });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
   if (err) throw err;

   // start the server if `$ node server.js`
   if (require.main === module) {
      var users = app.models.users;
   
      app.io = require('socket.io')(app.start());
      app.io.on('connection', function (socket) {
   
         socket.on('join', async({ username, room }, callback) => {
            try {
               const userExists = await users.find({ where : {"username": username, "room": room} });
               
               if (userExists.length > 0) {
                  callback(`User ${username} already exists in room no${room}. Please select a different name or room`);
               } else {
                  const user = await users.create({
                     "username": username,
                     "room": room,
                     "status": "ONLINE",
                     "socketId": socket.id
                  });
   
                  if (user) {
                     socket.join(user.room);
                     socket.emit('welcome', {
                        user: "bot",
                        text: `${user.username}, Welcome to room ${user.room}`,
                        userData: user
                     });
                     socket.broadcast.to(user.room).emit('message', {
                        user: 'bot',
                        text: `${user.username} has joined`,
                     });
                  } else {
                     callback("user could not be created. Try again!")
                  }
               }
               callback();
            } catch (err) {
               console.log("Error occuried", err);
            }
         });
         socket.on('disconnect', function () {
            console.log('user disconnected');
         });
      });
   }
});


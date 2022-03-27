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
      const usersModel = app.models.users;

      app.io = require('socket.io')(app.start());
      app.io.on('connection', function (socket) {

         //For when a user joins the chat
         socket.on('join', async ({ username, room }, callback) => {
            try {
               const userExists = await usersModel.find({ where: { "username": username, "room": room } });

               if (userExists.length > 0) {
                  callback(`User ${username} already exists in room no${room}. Please select a different name or room`);
               } else {
                  const user = await usersModel.create({
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
                     app.io.to(user.room).emit('roomInfo', {
                        room: user.room,
                        users: await getUsersInRoom(user.room)
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

         //Deleting user after disconnecting
         socket.on('disconnect', function () {
            // try {
            //    const user = await usersModel.destroyAll({ where: { socketId: socketId } })

            //    console.log("deleted user is", user);
            //    if (user.length > 0) {
            //       io.to(user[0].room).emit('message', {
            //          user: user[0].username,
            //          text: `User ${user[0].username} has left the chat.`,
            //       });
            //       io.to(user.room).emit('roomInfo', {
            //          room: user.room,
            //          users: await getUsersInRoom(user[0].room)
            //       });
            //    }
            // } catch (err) {
            //    console.log("error while disconnecting", err);
            // }
         });

         //Broadcasting the messages
         socket.on('sendMessage', async (data, callback) => {
            try {
               const user = await usersModel.findOne({ where: { id: data.userId } });

               if (user) {
                  app.io.to(user.room).emit('message', {
                     user: user.username,
                     text: data.message,
                  });
                  app.io.to(user.room).emit('roomInfo', {
                     room: user.room,
                     users: await getUsersInRoom(user.room)
                  });
               } else {
                  callback(`User doesn't exist in the database. Rejoin the chat`)
               }
               callback();
            } catch (err) {
               console.log("err inside catch block", err);
            }
         });

      });
   }
});

//Function to get users in a room
async function getUsersInRoom(room) {
   const usersModel = app.models.users;
   try {
      const usersInRoom = await usersModel.find({ where: { "room": room } });
      return usersInRoom;
   } catch (err) {
      console.log("Error.Try again!", err);
   }
}

// async function deleteUser(socketId) {
//    const usersModel = app.models.users;
//    try {
//        const user = await usersModel.destroyAll({ socketId: socketId });
//        return user;
//    } catch(err) {
//        console.log("Error while deleting the User", err);
//    }
// }
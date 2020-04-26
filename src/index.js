const express = require("express");
const bodyParser = require("body-parser");
var cors = require("cors");
const http = require("http");
const morgan = require("morgan");
const socketIo = require("socket.io");


const THRESHOLD = 200;
/**
 * a motion data frame is an object of the form:
 * {
 *    name: "TJVSV",
 *    timeStamp: 1023,
 *    acceleration: {
 *      x: 0,
 *      y: 0,
 *      z: -9.81
 *    }
 *  };
 * the timeStamp is in milliseconds
 */
let motionData = {};
const socketIdDeviceName = {};

const port = process.env.PORT || 4001;

const app = express();

/**
 * CREATE A SERVER OBJECT
 */
const server = http.createServer(app);

/**
 * SERVER CONFIGURATION
 */

// ensure the server can call other domains: enable cross origin resource sharing (cors) 
app.use(cors());

// received packages should be presented in the JSON format
app.use(bodyParser.json());

// show some helpful logs in the commandline
app.use(morgan("dev"));

/**
 * SOCKET CONFIGURATION
 */
// create socket server
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log("New client joined: ", socket.id);
  // emit the initial data
  socket.emit("motion_devices", Object.keys(motionData));

  // report on disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected");
    delete motionData[socketIdDeviceName[socket.id]];
    delete socketIdDeviceName[socket.id];
    socket.broadcast.emit("motion_devices", Object.keys(motionData));
  });

  socket.on("new_device", data => {
    console.log('register new device: ', data)

    if (data.name.length > 0) {
      motionData[data.name] = [];
      socketIdDeviceName[socket.id] = data.name;
    }
    socket.broadcast.emit("motion_devices", Object.keys(motionData));
  });

  socket.on("get_devices", () => {
    socket.emit("motion_devices", Object.keys(motionData));
  });

  socket.on("display_device", data => {
    if (data.oldDevice) {
      // leave the previous device room
      socket.leave(data.oldDevice);
    }
    // join the new sensor device room
    socket.join(data.name);
  });

  socket.on("new_motion_data", data => {
    // return if the device is not known
    if (!motionData[data.name]) {
      return;
    }
    // remove first element if too many elements are present
    if (motionData[data.name].length >= THRESHOLD) {
      motionData[data.name].shift();
    }
    // add the new motionData
    motionData[data.name].push(data);

    // and emit a 'motion_data' event to all the sockets within the room
    io.in(data.name).emit("motion_data", motionData[data.name]);
  });

  socket.on("clear_motion_data", data => {
    if (!motionData[data.name]) {
      return;
    }
    motionData[data.name] = [];
    // notify all the sockets within the room that data changed
    io.in(data.name).emit("motion_data", motionData);
  });
});

server.listen(port, () => console.log(`Listening on port ${port}`));

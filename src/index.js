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
 *    deviceId: "TJVSV",
 *    timeStamp: 1023,
 *    acceleration: {
 *      x: 0,
 *      y: 0,
 *      z: -9.81
 *    }
 *  };
 * the timeStamp is in milliseconds
 */
const motionData = {};
/**
 * a map to save socketId -> deviceId conversions
 */
const socketId_deviceId = {};

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

/**
 * @return [Array<string>] all currently active deviceIds
 */
function deviceIds() {
  return Object.keys(motionData);
}

io.on("connection", (socket) => {
  console.log("New client joined: ", socket.id);
  // emit the initial data
  socket.emit("motion_devices", Object.keys(motionData));

  // report on disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected: ", socket.id, socketId_deviceId[socket.id]);
    delete motionData[socketId_deviceId[socket.id]];
    delete socketId_deviceId[socket.id];
    io.emit("motion_devices", Object.keys(motionData));
  });

  socket.on("new_device", data => {
    console.log("register new device: ", data)

    if (data.deviceId.length > 0) {
      motionData[data.deviceId] = [];
      socketId_deviceId[socket.id] = data.deviceId;
    }
    io.emit("motion_devices", deviceIds());
  });

  socket.on("get_devices", () => {
    socket.emit("motion_devices", deviceIds());
  });

  socket.on("display_device", data => {
    socket.leave(data.oldDeviceId);
    // join the new sensor device room
    socket.join(data.deviceId);
  });

  socket.on("new_motion_data", data => {
    // return if the device is not known
    if (!motionData[data.deviceId]) {
      return;
    }
    // remove first element if too many elements are present
    if (motionData[data.deviceId].length >= THRESHOLD) {
      motionData[data.deviceId].shift();
    }
    // add the new motionData
    motionData[data.deviceId].push(data);

    // and emit a "motion_data" event to all the sockets within the room
    io.in(data.deviceId).emit("motion_data", motionData[data.deviceId]);
  });

  socket.on("clear_motion_data", data => {
    if (!motionData[data.deviceId]) {
      return;
    }
    motionData[data.deviceId] = [];
    // notify all the sockets within the room that data changed
    io.in(data.deviceId).emit("motion_data", motionData[data.deviceId]);
  });
});

server.listen(port, () => console.log(`Listening on port ${port}`));

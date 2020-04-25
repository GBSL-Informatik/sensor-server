const express = require("express");
const bodyParser = require("body-parser");
var cors = require("cors");
const http = require("http");
const morgan = require("morgan");
const socketIo = require("socket.io");


const THRESHOLD = 400;
/**
 * words are object of the form:
 * {
 *    timeStamp: e.timeStamp,
 *    acceleration: {
 *      x: 0,
 *      y: 0,
 *      z: -9.81
 *    }
 *  };
 */
const motionData = [];
let firstTimestamp = 0;

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

io.on("connection", socket => {
  console.log("New client joined: ", socket.id);
  // join room
  socket.join("motion_room");
  // emit the initial data
  socket.emit("motion_data", motionData);

  // report on disconnect
  socket.on("disconnect", () => console.log("Client disconnected"));

  socket.on("new_motion_data", data => {
    if (motionData.length === 0) {
      firstTimestamp = data.timeStamp;
    }
    // remove first element if too many elements are present
    if (motionData.length >= THRESHOLD) {
      motionData.shift();
    }
    
    data.timeStamp = data.timeStamp - firstTimestamp;
    // add the new motionData
    motionData.push(data);
    // and emit a 'circle_data' event to all the sockets within the room
    io.in("motion_room").emit("motion_data", motionData);
  });

  socket.on("clear_motion_data", _circle => {
    motionData.length = 0;
    io.in("motion_room").emit("motion_data", motionData);
  });
});

server.listen(port, () => console.log(`Listening on port ${port}`));

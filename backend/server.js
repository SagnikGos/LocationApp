require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

// Define Schema for User Location
const userLocationSchema = new mongoose.Schema({
  userId: String,
  latitude: Number,
  longitude: Number,
  updatedAt: { type: Date, default: Date.now }
});

const UserLocation = mongoose.model('UserLocation', userLocationSchema);

// WebSocket connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Receive location updates from user
  socket.on('updateLocation', async (data) => {
    console.log('Received location update:', data);
    const { userId, latitude, longitude } = data;

    await UserLocation.findOneAndUpdate(
      { userId },
      { latitude, longitude, updatedAt: Date.now() },
      { upsert: true, new: true }
    );

    // Broadcast the update to all clients
    io.emit('userLocationUpdate', { userId, latitude, longitude });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(5000, () => console.log('Server running on port 5000'));


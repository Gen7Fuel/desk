// MongoDB connection utility using Mongoose
const mongoose = require('mongoose');

const mongoUrl = 'mongodb://mongo:27017/desk'; // 'mongo' is the Docker Compose service name

async function connectToMongo() {
	if (mongoose.connection.readyState === 1) {
		return mongoose.connection;
	}
	await mongoose.connect(mongoUrl);
	console.log('Connected to MongoDB with Mongoose');
	return mongoose.connection;
}

function getDb() {
	if (mongoose.connection.readyState !== 1) {
		throw new Error('MongoDB not connected! Call connectToMongo() first.');
	}
	return mongoose.connection;
}

module.exports = { connectToMongo, getDb };

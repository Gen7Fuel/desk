// MongoDB connection utility using Mongoose
const mongoose = require('mongoose');

const mongoUrl = process.env.MONGO_URI || 'mongodb://db:27017/desk';

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

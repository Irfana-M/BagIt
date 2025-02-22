const mongoose = require('mongoose');

// Define the Transaction Schema
const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit'], // Type of transaction (credit or debit)
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now, // Automatically set the current date
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId, // Reference to an order (if applicable)
    ref: 'Order',
  },
});

// Define the Wallet Schema
const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the user
    ref: 'User',
    required: true,
    unique: true, // Each user can have only one wallet
  },
  balance: {
    type: Number,
    default: 0, // Default balance is 0
    min: 0, // Balance cannot be negative
  },
  transactions: [transactionSchema], // Array of transactions
});

// Create the Wallet Model
const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet; 
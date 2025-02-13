const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    orderGroupId: {
        type: String,
        required: true
    },
    productId: {  
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Order Placed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered','Cancelled', 'Return request', 'Returned'],
        default: 'Order Placed'
    },
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    address: {
        type: Schema.Types.ObjectId,
        ref: "Address",
        required: true
    },
    invoiceDate: {
        type: Date,
        default: Date.now,
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    coupenApplied: {
        type: Boolean,
        default: false
    },
    paymentId:{
        type:String,
        required:false
    },
    paymentMethod: { type: String, required: true },
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;

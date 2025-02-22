const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const orderSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    orderId: {
      type: String,
      default: () => uuidv4(),
      unique: true
    },
    orderItems: [
      {
        product: {  
          type: Schema.Types.ObjectId,
          ref: "Product",
          required: true
        },
        quantity: {
          type: Number,
          required: true,
          min: 1
        },
        price: {
          type: Number,
          required: true
        },
        status: {
          type: String,
          enum: ['Order Placed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Requested', 'Returned'],
          default: 'Order Placed'
        },
        cancellationReason: { type: String, default: null },
        returnReason:{
          type:String,
          default:""
      },
      returnStatus:{
          type:String,
          enum:["None","Requested","Approved","Rejected"],
          default:"None"
      },
      refundAmount:{
          type:Number,
          default:0
      },
      isReplaced:{
          type:Boolean,
          default:false
      }
        
      }
    ],
    
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
    paymentInfo: {
      method: { 
        type: String,
        enum: ['Cash on Delivery', 'Online Payment'],
        default: 'Cash on Delivery',
        required: true 
      },
      isPaid: {
        type: Boolean,
        default: false
      },
      paidAt: {
        type: Date
      },
      transactionId: {
        type: String // Store payment transaction ID for online payments
      }
    },
    shippingAddress: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true
    },
    couponApplied: {
      type: Boolean,
      default: false
    },
    invoiceDate: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true } // Automatically adds `createdAt` & `updatedAt`
);

// Indexes for performance optimization
orderSchema.index({ user: 1, createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;

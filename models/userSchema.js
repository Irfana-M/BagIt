const mongoose = require('mongoose');
const {Schema} = mongoose;

const userSchema = new Schema({
    name : {
        type:String,
        required:true
    },
    // lasttName : {
    //     type:String,
    //     required:true
    // },
    email: {
        type:String,
        required:false,
        unique:true,
    },
    phone :{
        type:String,
        required:false,
        unique:false,
        sparse:true,
        default:null
    },
    googleId :{
        type:String,
        unique:false,
        default:null

    },
    password :{
        type:String,
        required:false,

    },
    isBlocked :{
        type:Boolean,
        default:false
    },
    isAdmin :{
        type:Boolean,
        default:false
    },
    cart :[{
        type: Schema.Types.ObjectId,
        ref:"Cart"
    }],
    wallet:[{
        type:Number,
        default:0
    }],
    wishlist :[{
        type:Schema.Types.ObjectId,
        ref:"Wishlist"
    }],
    orderHistory :[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdOn :{
        type:Date,
        default:Date.now,
    },
    referalCode:{
        type:String
    },
    redeemed :{
        type:Boolean
    },
    redeemedUsers :[{
        type: Schema.Types.ObjectId,
        ref:"User"
    }],
    searchHistory :[{
        category: {
            type: Schema.Types.ObjectId,
            ref:"Category",
        },
        brand:{
            type :String
        },
        searchOn :{
            type: Date,
            default:Date.now
        }
    }],
    addresses: [{
        type: Schema.Types.ObjectId,
        ref: "Address"  // Assuming "Address" is the name of your Address model
    }]
    
    
})

const User = mongoose.model("User",userSchema);
module.exports = User;
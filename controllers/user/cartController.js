const User = require("../../models/userSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const { v4: uuidv4 } = require("uuid");
const { session } = require("passport");




const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.query.id;

    if (!userId) {
      return res.status(401).json({
        status: "error",
        message: "User not logged in",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found",
      });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
 
      cart = new Cart({
        userId,
        items: [
          {
            productId: product._id,
            quantity: 1,
            price: product.salePrice,
            totalPrice: product.salePrice,
          },
        ],
      });
    } else {
      
      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (itemIndex > -1) {
        
        const newQuantity = cart.items[itemIndex].quantity + 1;

        
        if (newQuantity > product.quantity) {
          return res.status(400).json({
            status: "error",
            message: `Insufficient stock. Only ${product.quantity} items available.`,
          });
        }

        cart.items[itemIndex].quantity = newQuantity;
        cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * newQuantity;
      } else {
        
        cart.items.push({
          productId: product._id,
          quantity: 1,
          price: product.salePrice,
          totalPrice: product.salePrice,
        });
      }
    }

    await cart.save();

    return res.status(200).json({
      status: "success",
      message: "Product added to cart",
    });
  } catch (error) {
    console.error("Error adding product to cart:", error);
    return res.status(500).json({
      status: "error",
      message: "Server Error",
    });
  }
};


const viewCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    
    if (!userId) {
      return res.redirect("/login");
    }
    const page = parseInt(req.query.page) || 1; 
    const itemsPerPage = 10; 
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.render("cart", { cart: null, message: "Your cart is empty" });
    }

    const totalItems = cart.items.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedItems = cart.items.slice((page - 1) * itemsPerPage, page * itemsPerPage);
    let totalPriceWithoutOffer = paginatedItems.reduce(
      (acc, item) => acc + item.productId.regularPrice * item.quantity,
      0
    );
    let totalPriceWithOffer = paginatedItems.reduce(
      (acc, item) => acc + item.productId.salePrice * item.quantity,
      0
    );
    let totalDiscount = totalPriceWithoutOffer - totalPriceWithOffer;
    let shippingCharge = 50;

    res.render("cart", {
      user:userData,
      errorMessage: null,
      successMessage: null,
      cart: paginatedItems, 
      totalPriceWithoutOffer,
      finalTotal: totalPriceWithOffer,
      totalDiscount,
      shippingCharge,
      currentPage: page,
      totalPages: totalPages,
    });
  } catch (error) {
    console.error("Error viewing cart:", error);
    res.render("shop", {
      message: "Server Error, please try again!",
      status: "failure",
    });
  }
};




const updateCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || quantity < 1) {
      return res.status(400).json({ success: false, message: "Invalid request" });
    }

    
    let cartItem = await Cart.findOne({ "items.productId": productId }).populate("items.productId");

    if (!cartItem) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    
    let itemIndex = cartItem.items.findIndex(item => item.productId._id.toString() === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: "Product not found in cart" });
    }

    let product = cartItem.items[itemIndex].productId; 
    if (quantity > product.quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.quantity} items available in stock` });
    }

    
    cartItem.items[itemIndex].quantity = quantity;
    cartItem.items[itemIndex].totalPrice = product.salePrice * quantity;

    
    cartItem.totalPriceWithOffer = cartItem.items.reduce((sum, item) => sum + (item.quantity * item.productId.salePrice), 0);
    cartItem.totalPriceWithoutOffer = cartItem.items.reduce((sum, item) => sum + (item.quantity * item.productId.regularPrice), 0);
    cartItem.totalDiscount = cartItem.totalPriceWithoutOffer - cartItem.totalPriceWithOffer;

    
    await cartItem.save();
    req.session.cart = cartItem;

    res.json({
      success: true,
      message: "Cart updated successfully",
      newTotalPrice: cartItem.items[itemIndex].totalPrice,
      finalTotal: cartItem.totalPriceWithOffer,
      totalOriginalPrice: cartItem.totalPriceWithoutOffer,
      totalDiscount: cartItem.totalDiscount
    });

  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};





const deleteCart = async (req, res) => {
  try {
    const productId = req.query.id;

    
    let cart = await Cart.findOne({ "items.productId": productId }).populate("items.productId");
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    
    const itemIndex = cart.items.findIndex(item => item.productId._id.toString() === productId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: "Product not found in cart" });
    }

    
    cart.items.splice(itemIndex, 1);

    
    cart.totalPriceWithOffer = cart.items.reduce((sum, item) => sum + (item.quantity * item.productId.salePrice), 0);
    cart.totalPriceWithoutOffer = cart.items.reduce((sum, item) => sum + (item.quantity * item.productId.regularPrice), 0);
    cart.totalDiscount = cart.totalPriceWithoutOffer - cart.totalPriceWithOffer;

    
    await cart.save();
    req.session.cart = cart; 

    res.redirect("/view-cart");
  } catch (error) {
    console.error("Error in deleting product from cart:", error);
    res.redirect("/pageNotFound");
  }
};




const getCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await Address.findOne({ userId });
    const addresses = user ? user : [];
    const userData = await User.findById(userId);
    
    let cart = await Cart.findOne({ userId }).populate("items.productId");

    
    if (!cart && req.session.cart) {
      cart = new Cart({
        userId,
        items: req.session.cart.items,
      });
    } else if (!cart && !req.session.cart) {
      return res.render("cart", { cart: null, message: "Your cart is empty" });
    }

    
    let updatedItems = [];
    for (let item of cart.items) {
      let product = await Product.findById(item.productId._id);
      if (!product || product.quantity < item.quantity) {
        req.session.outOfStockMessage = `Some items were removed due to stock limitations.`;
      } else {
        updatedItems.push(item);
      }
    }

    if (updatedItems.length === 0) {
      await Cart.deleteOne({ userId });
      req.session.cart = null;
      return res.render("cart", { cart: null, message: "Your cart is empty due to stock unavailability." });
    }

    
    cart.items = updatedItems;
    await cart.save(); 
    req.session.cart = cart.toObject(); 

   
    const productIds = cart.items.map((item) => item.productId._id);
    const products = await Product.find({ _id: { $in: productIds } }, "productOffer");

    const productOfferMap = products.reduce((acc, product) => {
      acc[product._id.toString()] = product.productOffer || 0;
      return acc;
    }, {});

    const totalProductOffer = cart.items.reduce((acc, item) => {
      return acc + ((productOfferMap[item.productId._id.toString()] || 0) * item.quantity);
    }, 0);

    
    let totalOriginalPrice = 0;
    let totalOfferPrice = 0;
    let totalDiscount = 0;
    
    let subTotal = 0;
    let couponDiscount = 0;

    cart.items.forEach((item) => {
      totalOriginalPrice += item.productId.regularPrice * item.quantity;
      totalOfferPrice += item.productId.salePrice * item.quantity;
    });
    const GST = totalOfferPrice * 0.18;
    totalDiscount = totalOriginalPrice - totalOfferPrice;
    const shippingCharge = totalOfferPrice < 1000 ? 50 : 0;
    subTotal = totalOfferPrice + shippingCharge+GST;

    
    const today = new Date();
    const coupons = await Coupon.find({
      isList: true,
      expireOn: { $gt: today },
    });

    let appliedCoupon = req.session.appliedCoupon;
    if (appliedCoupon) {
      if (subTotal >= appliedCoupon.minimumPrice) {
        couponDiscount = appliedCoupon.discount;
      } else {
        req.session.appliedCoupon = null;
      }
    }

    couponDiscount = Math.min(couponDiscount, subTotal);
    let finalTotal = subTotal - couponDiscount;
    
    const razorpayKey = process.env.RAZORPAY_KEY_ID;

    
    res.render("checkout", {
      user:userData,
      addresses,
      cart,
      totalOriginalPrice,
      totalOfferPrice,
      totalProductOffer: totalProductOffer || null,
      totalDiscount,
      subTotal,
      shippingCharge,
      coupons,
      appliedCoupon: req.session.appliedCoupon || null,
      couponDiscount,
      finalTotal,
      couponSuccess: req.session.couponSuccess || null,
      couponError: req.session.couponError || null,
      razorpayKey,
      outOfStockMessage: req.session.outOfStockMessage || null,
    });

    
    req.session.couponSuccess = null;
    req.session.couponError = null;
    req.session.outOfStockMessage = null;

  } catch (error) {
    console.error("Error in getCheckout:", error);
    res.redirect("/pageNotFound");
  }
};



const getSingleProductCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await Address.findOne({ userId });
    const addresses = user ? user : [];
    const userData = await User.findById(userId);

    let { id, quantity } = req.query;
    console.log("Query items:", req.query);

    if (!id) {
      return res.redirect("/cart"); 
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.redirect("/cart"); 
    }

    
    if (product.quantity < quantity) {
      return res.render("cart", { cart: null, message: "Selected product is out of stock." });
    }

    
    const parsedQuantity = parseInt(quantity, 10) || 1;

    
    const cart = {
      items: [{ productId: product, quantity: parsedQuantity }]
    };

    console.log("Single product checkout cart:", cart);

    const productOffer = product.productOffer || 0;
    const totalProductOffer = productOffer * parsedQuantity;

    let totalOriginalPrice = product.regularPrice * parsedQuantity;
    let totalOfferPrice = product.salePrice * parsedQuantity;
    const shippingCharge = totalOfferPrice < 1000 ? 50 : 0;
    let totalDiscount = totalOriginalPrice - totalOfferPrice;
    let subTotal = totalOfferPrice + shippingCharge;
    let couponDiscount = 0;

    const today = new Date();
    const coupons = await Coupon.find({
      isList: true,
      expireOn: { $gt: today },
    });

    let appliedCoupon = req.session.appliedCoupon;
    if (appliedCoupon) {
      if (subTotal >= appliedCoupon.minimumPrice) {
        couponDiscount = appliedCoupon.discount;
      } else {
        req.session.appliedCoupon = null;
      }
    }

    couponDiscount = Math.min(couponDiscount, subTotal);
    let finalTotal = subTotal - couponDiscount;
    const razorpayKey = process.env.RAZORPAY_KEY_ID;

    res.render("checkout", {
      user:userData,
      addresses,
      cart,
      totalOriginalPrice,
      totalOfferPrice,
      totalProductOffer,
      totalDiscount,
      subTotal,
      shippingCharge,
      coupons,
      appliedCoupon: req.session.appliedCoupon || null,
      couponDiscount,
      finalTotal,
      couponSuccess: req.session.couponSuccess || null,
      couponError: req.session.couponError || null,
      razorpayKey,
      singleProductId: id 
    });

    req.session.couponSuccess = null;
    req.session.couponError = null;
  } catch (error) {
    console.error("Error in getSingleProductCheckout:", error);
    res.redirect("/pageNotFound");
  }
};


const getConfirmation = async (req, res) => {
  try {
    const { addressId, totalPrice, paymentMethod, paymentStatus, orderId } = req.query;
    console.log("Query Parameters:", req.query);

    const userId = req.session.user;
    const userData = await User.findById(userId);
    if (!userId) {
      return res.redirect("/checkout");
    }

    let order, shippingAddress, rawCartItems, totalOriginalPrice, totalOfferPrice, couponDiscount, shippingCharge;
    let finalPaymentMethod = paymentMethod;
    let finalPaymentStatus = paymentStatus;

    
    if (orderId) {
      
      order = await Order.findById(orderId).populate("orderItems.product");
      if (!order) {
        console.error("Order not found for orderId:", orderId);
        return res.redirect("/checkout");
      }

      if (order.user.toString() !== userId) {
        return res.status(403).send("Unauthorized");
      }

      
      const addressData = await Address.findOne(
        { "address._id": order.shippingAddress },
        { "address.$": 1 } 
      );

      if (!addressData || !addressData.address || addressData.address.length === 0) {
        console.error("Shipping address not found for order:", orderId, "with shippingAddress ID:", order.shippingAddress);
        return res.redirect("/checkout");
      }

      shippingAddress = addressData.address[0]; 
      rawCartItems = order.orderItems.map(item => ({
        productId: item.product,
        quantity: item.quantity,
        price: item.price,
      }));
      totalOfferPrice = order.totalPrice;
      couponDiscount = order.couponApplied ? order.discount : 0;
      totalOriginalPrice = rawCartItems.reduce((total, item) => total + (item.productId.regularPrice || 0) * item.quantity, 0);
      const totalDiscount = totalOriginalPrice - totalOfferPrice;

      shippingCharge = totalOfferPrice < 1000 ? 50 : 0;

      gst = (totalOfferPrice * 0.18).toFixed(2);

      subTotal = (parseFloat(totalOfferPrice) - parseFloat(couponDiscount) + parseFloat(shippingCharge) + parseFloat(gst)).toFixed(2);

      finalPaymentMethod = finalPaymentMethod || order.paymentInfo.method;
      finalPaymentStatus = finalPaymentStatus || order.paymentInfo.status;
    } 
    
    else if (addressId && totalPrice) {
      const addressData = await Address.findOne(
        { userId: userId, "address._id": addressId },
        { "address.$": 1 }
      );

      if (!addressData || !addressData.address || addressData.address.length === 0) {
        console.error("No address found for userId:", userId, "and addressId:", addressId);
        return res.redirect("/checkout");
      }

      shippingAddress = addressData.address[0];
      rawCartItems = Array.isArray(req.session.cartItems) ? req.session.cartItems : [];
      totalOfferPrice = parseFloat(totalPrice);
      couponDiscount = req.session.cart?.appliedCoupon?.discount || 0;
      totalOriginalPrice = rawCartItems.reduce((total, item) => total + (item.productId?.regularPrice || 0) * item.quantity, 0);
      const totalDiscount = totalOriginalPrice - totalOfferPrice;

      shippingCharge = totalOfferPrice < 1000 ? 50 : 0;

      gst = (totalOfferPrice * 0.18).toFixed(2);

      subTotal = (parseFloat(totalOfferPrice) - parseFloat(couponDiscount) + parseFloat(shippingCharge) + parseFloat(gst)).toFixed(2);

      finalPaymentMethod = finalPaymentMethod || "Online";
      finalPaymentStatus = finalPaymentStatus || "Success";
    } 
    else {
      console.error("Invalid query parameters: require either orderId or addressId+totalPrice");
      return res.redirect("/checkout");
    }

    const totalDiscount = totalOriginalPrice - totalOfferPrice;

    if (finalPaymentStatus !== "pending") {
      for (let item of rawCartItems) {
        const product = await Product.findById(item.productId._id || item.productId);
        if (product) {
          if (product.quantity < item.quantity) {
            return res.status(400).send(`Insufficient stock for ${product.name}`);
          }
          product.quantity -= item.quantity;
          await product.save();
        }
      }
    }

    console.log("Rendering confirmation page with data:", {
      selectedAddress: shippingAddress,
      totalPrice: totalOfferPrice,
      subTotal: subTotal,
      totalOriginalPrice,
      totalDiscount,
      shippingCharge,
      paymentMethod: finalPaymentMethod,
      paymentStatus: finalPaymentStatus,
      couponDiscount,
      gst,
      cartItems: rawCartItems,
      
    });

    res.render("confirmation", {
      selectedAddress: shippingAddress,
      totalPrice: totalOfferPrice,
      subTotal: subTotal,
      totalOriginalPrice,
      totalDiscount,
      shippingCharge,
      paymentMethod: finalPaymentMethod,
      paymentStatus: finalPaymentStatus,
      couponDiscount,
      gst, 
      user:userData,
      cartItems: rawCartItems,
      deliveryDateNew: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" }),
    });
  } catch (e) {
    console.error("An error occurred:", e.message);
    return res.status(500).send("Something went wrong!");
  }
};


const applyCoupon = async (req, res) => {
  try {
      const { couponCode, totalBeforeCoupon } = req.body;

      if (!couponCode || typeof totalBeforeCoupon !== 'number') {
          return res.json({ success: false, message: "Invalid input" });
      }

      // Fetch coupon details from Coupon schema
      const coupon = await Coupon.findOne({ name: couponCode }).lean();
      if (!coupon || !coupon.createdOn || !coupon.expireOn) {
          return res.json({ success: false, message: "Invalid or expired coupon" });
      }

      const today = new Date().setHours(0, 0, 0, 0);
      const createdOn = new Date(coupon.createdOn).setHours(0, 0, 0, 0);
      const expireOn = new Date(coupon.expireOn).setHours(23, 59, 59, 999);

      if (today < createdOn || today > expireOn) {
          return res.json({ success: false, message: "Coupon Expired or Not Yet Valid" });
      }

      // Check minimum price requirement
      if (totalBeforeCoupon < coupon.minimumPrice) {
          return res.json({ success: false, message: `Minimum purchase should be ₹${coupon.minimumPrice}` });
      }

      // Apply coupon discount
      const couponDiscount = coupon.offerPrice;
      const finalTotal = Math.max(totalBeforeCoupon - couponDiscount, 0);

      // Store in session
      req.session.cart = req.session.cart || {};
      req.session.cart.finalTotal = finalTotal;
      req.session.cart.appliedCoupon = {
          name: coupon.name,
          discount: couponDiscount,
      };
      req.session.save();

      console.log("Coupon in session:", req.session.cart.appliedCoupon);

      return res.json({
          success: true,
          message: "Coupon Applied Successfully!",
          couponDiscount,
          finalTotal,
          appliedCoupon: req.session.cart.appliedCoupon
      });

  } catch (error) {
      console.error("Error applying coupon:", error);
      return res.status(500).json({ success: false, message: "Something went wrong" });
  }
};


const removeCoupon = async (req, res) => {
  try {
      const cart = req.session.cart || {};
      console.log("Before removing:", cart.appliedCoupon);

      if (!cart.appliedCoupon) {
          return res.json({ success: false, message: "No coupon applied" });
      }

      
      const currentFinalTotal = cart.finalTotal || 0;
      const couponDiscount = cart.appliedCoupon.discount || 0;

      
      const finalTotal = currentFinalTotal + couponDiscount;

     
      delete cart.appliedCoupon;
      cart.finalTotal = finalTotal;
      req.session.save();

      console.log("After removing:", cart.appliedCoupon);

      return res.json({
          success: true,
          message: "Coupon deleted successfully",
          finalTotal
      });
  } catch (error) {
      console.error("Error removing coupon:", error);
      return res.json({ success: false, message: "Something went wrong" });
  }
};




module.exports = {
  addToCart,
  viewCart,
  deleteCart,
  getCheckout,
  getConfirmation,
  applyCoupon,
  removeCoupon,
  updateCart,
  getSingleProductCheckout
};
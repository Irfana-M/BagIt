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

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send("Product not found");
    }
    //let cartFromSession = req.session.cart || { items: [] };;
    const price = product.salePrice;
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [
          {
            productId: product._id,
            quantity: 1,
            price,
            totalPrice: price,
          },
        ],
      });
    } else {
      const itemIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += 1;
        cart.items[itemIndex].totalPrice =
          cart.items[itemIndex].price * cart.items[itemIndex].quantity;
      } else {
        cart.items.push({
          productId: product._id,
          quantity: 1,
          price,
          totalPrice: price,
        });
      }
    }
    
    
    await cart.save();
    // req.session.cart = cart;
    req.session.message = { status: "success", message: "Item added to cart" };
    return res.redirect("/shop");
  } catch (error) {
    console.error("Error adding item to cart:", error);
    req.session.message = { status: "failure", message: "Server Error" };
    return res.redirect("/shop");
  }
};



const viewCart = async (req, res) => {
  try {
    const userId = req.session.user;
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

    // Fetch user's cart and populate product details
    let cart = req.session.cart || await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.render("cart", { cart: null, message: "Your cart is empty" });
    }

    // Validate stock availability
    let updatedItems = [];
    for (let item of cart.items) {
      let product = await Product.findById(item.productId._id);
      if (!product || product.quantity < item.quantity) {
        req.session.outOfStockMessage = `Some items were removed due to stock limitations.`;
      } else {
        updatedItems.push(item);
      }
    }

    // If no items are left after stock validation, empty the cart
    if (updatedItems.length === 0) {
      await Cart.deleteOne({ userId });
      req.session.cart = null;
      return res.render("cart", { cart: null, message: "Your cart is empty due to stock unavailability." });
    }

    cart.items = updatedItems;
    await cart.save();
    req.session.cart = cart;

    // Fetch product offers
    const productIds = cart.items.map(item => item.productId._id);
    const products = await Product.find({ _id: { $in: productIds } }, 'productOffer');

    const productOfferMap = products.reduce((acc, product) => {
      acc[product._id.toString()] = product.productOffer || 0;
      return acc;
    }, {});

    const totalProductOffer = cart.items.reduce((acc, item) => {
      return acc + ((productOfferMap[item.productId._id.toString()] || 0) * item.quantity);
    }, 0);

    req.session.cart = cart;

    // Calculate pricing details
    let totalOriginalPrice = 0;
    let totalOfferPrice = 0;
    let totalDiscount = 0;
    let shippingCharge = 50;
    let subTotal = 0;
    let couponDiscount = 0;

    cart.items.forEach((item) => {
      totalOriginalPrice += item.productId.regularPrice * item.quantity;
      totalOfferPrice += item.productId.salePrice * item.quantity;
    });

    totalDiscount = totalOriginalPrice - totalOfferPrice;
    subTotal = totalOfferPrice + shippingCharge;

    // Apply coupon if valid
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

    // Render checkout page
    res.render("checkout", {
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
      outOfStockMessage: req.session.outOfStockMessage || null
    });

    // Reset session messages
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

    let { id, quantity } = req.query;
    console.log("Query items:", req.query);

    if (!id) {
      return res.redirect("/cart"); 
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.redirect("/cart"); 
    }

    // Validate stock availability
    if (product.quantity < quantity) {
      return res.render("cart", { cart: null, message: "Selected product is out of stock." });
    }

    // Parse and validate quantity
    const parsedQuantity = parseInt(quantity, 10) || 1;

    // Temporary cart for single product checkout
    const cart = {
      items: [{ productId: product, quantity: parsedQuantity }]
    };

    console.log("Single product checkout cart:", cart);

    const productOffer = product.productOffer || 0;
    const totalProductOffer = productOffer * parsedQuantity;

    let totalOriginalPrice = product.regularPrice * parsedQuantity;
    let totalOfferPrice = product.salePrice * parsedQuantity;
    let totalDiscount = totalOriginalPrice - totalOfferPrice;
    let shippingCharge = 50;
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
    const { addressId, totalPrice, paymentMethod } = req.query;

    if (!addressId) {
      return res.redirect("/checkout");
    }

    const userId = req.session.user;

    const addressData = await Address.findOne(
      { userId, "address._id": addressId },
      { "address.$": 1 }
    );

    if (!addressData || !addressData.address.length) {
      return res.redirect("/checkout");
    }

    const shippingAddress = addressData.address[0];
    const appliedCoupon = req.session.cart?.appliedCoupon?.discount || { discount: 0 };
    const couponDiscount = appliedCoupon.discount || 0;
    const shippingCharge = 50;

    let totalOriginalPrice = 0;
    let totalOfferPrice = totalPrice;
    const rawCartItems = req.session.cartItems || [];

    // Calculate total original price
    rawCartItems.forEach((item) => {
      if (item.productId && item.productId.regularPrice) {
        totalOriginalPrice += item.productId.regularPrice * item.quantity;
      }
    });

    const totalDiscount = totalOriginalPrice - totalOfferPrice;

    // Update product stock
    for (let item of rawCartItems) {
      const product = await Product.findById(item.productId._id);
      if (product) {
        if (product.quantity < item.quantity) {
          return res.status(400).send(`Insufficient stock for ${product.name}`);
        }
        product.quantity -= item.quantity;
        await product.save();
      }
    }

    console.log("Rendering confirmation page with the following data:", {
      selectedAddress: shippingAddress,
      totalPrice,
      subTotal: totalPrice - couponDiscount + shippingCharge,
      totalOriginalPrice,
      totalDiscount,
      shippingCharge,
      paymentMethod,
      couponDiscount,
      cartItems: rawCartItems,
    });

    res.render("confirmation", {
      selectedAddress: shippingAddress,
      totalPrice,
      subTotal: totalPrice - couponDiscount + shippingCharge,
      totalOriginalPrice,
      totalDiscount,
      shippingCharge,
      paymentMethod,
      couponDiscount,
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
      const { couponCode, cartItems } = req.body;

      if (!Array.isArray(cartItems) || cartItems.length === 0) {
          return res.json({ success: false, message: "Cart is empty" });
      }

      const productIds = cartItems.map(item => item.productId).filter(Boolean);

      if (productIds.length === 0) {
          return res.json({ success: false, message: "No valid products in cart" });
      }

      const products = await Product.find({ _id: { $in: productIds } }, 'productOffer').lean();

      const productOfferMap = products.reduce((acc, product) => {
          acc[product._id.toString()] = product.productOffer ?? 0;
          return acc;
      }, {});

      const totalProductOffer = cartItems.reduce((acc, item) => {
          const offerAmount = productOfferMap[item.productId.toString()] ?? 0;
          return acc + (offerAmount * (item.quantity ?? 0));
      }, 0);

      const subTotal = cartItems.reduce((acc, item) => acc + (item.price * (item.quantity ?? 0)), 0);
      const totalOfferPrice = subTotal - totalProductOffer;

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

      if (totalOfferPrice < coupon.minimumPrice) {
          return res.json({ success: false, message: `Minimum purchase should be ₹${coupon.minimumPrice}` });
      }

      const couponDiscount = coupon.offerPrice;
      const finalTotal = Math.max(totalOfferPrice - couponDiscount, 0);

      // ✅ Store subTotal, finalTotal, and appliedCoupon in session
      req.session.cart = req.session.cart || {};
      req.session.cart.subTotal = subTotal;  // <-- Store subtotal
      req.session.cart.finalTotal = finalTotal;  // <-- Store final total after discount
      req.session.cart.appliedCoupon = {
          name: coupon.name,
          discount: couponDiscount,
      };
      req.session.save();
console.log("coupo in session is",req.session.cart.appliedCoupon)
      return res.json({
          success: true,
          message: "Coupon Applied Successfully!",
          subTotal,
          totalProductOffer,
          totalOfferPrice,
          finalTotal,
          couponDiscount,
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

      delete req.session.cart.appliedCoupon;
      req.session.cart.finalTotal = req.session.cart.subTotal;  // <-- Reset final total to subTotal
      req.session.save();

      console.log("After removing:", req.session.cart.appliedCoupon);

      return res.json({ success: true, message: "Coupon Removed", finalTotal: req.session.cart.finalTotal });
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

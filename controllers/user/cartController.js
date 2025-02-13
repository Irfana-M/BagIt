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
    product.quantity -= 1;
    await product.save();
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
      cart: paginatedItems, // Send paginated items to the view
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



const deleteCart = async (req, res) => {
  try {
    const productId = req.query.id;
    const cart = await Cart.findOne({ "items.productId": productId });
    if (!cart) {
      return res.status(404).send("Cart not found");
    }

    const item = cart.items.find(
      (item) => item.productId.toString() === productId
    );
    if (!item) {
      return res.status(404).send("Product not found in cart");
    }

    const removedQuantity = item.quantity;
    await Product.findByIdAndUpdate(productId, {
      $inc: { quantity: removedQuantity },
    });

    await Cart.updateOne(
      { "items.productId": productId },
      {
        $pull: {
          items: {
            productId: productId,
          },
        },
      }
    );

    res.redirect("/view-cart");
  } catch (error) {
    console.error("Error in delete product", error);
    res.redirect("/pageNotFound");
  }
};

const getCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await Address.findOne({ userId });
    const addresses = user ? user : [];

    
    let cart = req.session.cart || await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.render("cart", { cart: null, message: "Your cart is empty" });
    }

    const productIds = cart.items.map(item => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }, 'productOffer');

    const productOfferMap = products.reduce((acc, product) => {
        acc[product._id.toString()] = product.productOffer || 0;
        return acc;
    }, {});

    const totalProductOffer = cart.items.reduce((acc, item) => {
        return acc + ((productOfferMap[item.productId.toString()] || 0) * item.quantity);
    }, 0);


    req.session.cart = cart;

    
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
      totalProductOffer:totalProductOffer||null,
      totalDiscount,
      subTotal,
      shippingCharge,
      coupons, 
      appliedCoupon: req.session.appliedCoupon || null,
      couponDiscount,
      finalTotal,
      couponSuccess: req.session.couponSuccess || null,
      couponError: req.session.couponError || null,
      razorpayKey
    });
    req.session.couponSuccess = null;
    req.session.couponError = null;
  } catch (error) {
    console.error("Error in getCheckout:", error);
    res.redirect("/pageNotFound");
  }
};





const getConfirmation = async (req, res) => {
  try {
    const { addressId, totalPrice, cartItems, paymentMethod, paymentId } = req.query;

    if (!cartItems) {
      return res.redirect("/checkout");
    }

    let rawCartItems = JSON.parse(decodeURIComponent(cartItems));

    if (!addressId) {
      return res.redirect("/checkout");
    }

    const userId = req.session.user;

    // Fetch the selected address
    const addressData = await Address.findOne(
      { userId, "address._id": addressId },
      { "address.$": 1 }
    );

    if (!addressData || !addressData.address.length) {
      return res.redirect("/checkout");
    }

    const selectedAddress = addressData.address[0];

    // Calculate Total Price Before and After Discounts
    let totalOriginalPrice = 0;
    let totalOfferPrice = 0;

    rawCartItems.forEach((item) => {
      if (item.productId && item.productId.regularPrice && item.productId.salePrice) {
        totalOriginalPrice += item.productId.regularPrice * item.quantity;
        totalOfferPrice += item.productId.salePrice * item.quantity;
      }
    });

    const totalDiscount = totalOriginalPrice - totalOfferPrice;
    const shippingCharge = 50;

    // Fetch applied coupon (if any)
    const appliedCoupon = req.session.cart?.appliedCoupon?.discount || { discount: 0 };
    const couponDiscount = appliedCoupon.discount || 0;

    // Final amount after applying coupon discount
    let finalAmount = totalOfferPrice - couponDiscount + shippingCharge;
    finalAmount = Math.max(finalAmount, 0); // Ensure final amount is not negative

    const orderStatus = paymentMethod === "Cash on Delivery" ? "Pending" : "Order Placed";
    const currentDate = new Date();

    // Invoice Date
    const invoiceDate = currentDate.toISOString();

    // Expiry Date (e.g., 30 days from order date)
    const expireDate = new Date();
    expireDate.setDate(currentDate.getDate() + 30);
    const formattedExpireDate = expireDate.toISOString();
    const orderGroupId = uuidv4(); 

    // Save Order Details for all items in the cart
    const orderPromises = rawCartItems.map(async (item) => {
      const newOrder = new Order({
        userId,
        productId: item.productId._id,
        quantity: item.quantity,
        price: item.productId.salePrice,
        status: orderStatus,
        totalPrice: totalOfferPrice,
        discount: totalDiscount + couponDiscount, // Include both product and coupon discounts
        finalAmount: finalAmount,
        address: selectedAddress._id,
        createdOn: invoiceDate,
        orderId: uuidv4(),
        paymentMethod,
        paymentId: paymentMethod === "razorPay" ? paymentId : null, // Store paymentId for Razorpay
        orderGroupId: orderGroupId, // Assign orderGroupId
        totalDiscount,
        couponApplied:couponDiscount>0
      });
      await newOrder.save();
    });

    await Promise.all(orderPromises);


    if (paymentMethod !== "Cash on Delivery") {
      await Promise.all(
        rawCartItems.map(async (item) => {
          const product = await Product.findById(item.productId._id);
          if (product) {
            product.quantity -= item.quantity;
            await product.save();
          }
        })
      );
    }

    // Clear cart after placing order
    await Cart.deleteOne({ userId });

    console.log("Rendering confirmation page with the following data:", {
      selectedAddress,
      totalPrice: totalOfferPrice,
      totalOriginalPrice,
      subTotal: finalAmount,
      shippingCharge,
      paymentMethod,
      couponDiscount,
      totalDiscount,
    });

    // Render confirmation page
    res.render("confirmation", {
      selectedAddress,
      totalPrice: totalOfferPrice,
      cartItems: rawCartItems,
      totalOriginalPrice,
      subTotal: finalAmount,
      shippingCharge,
      paymentMethod,
      couponDiscount,
      totalDiscount,
      deliveryDateNew: expireDate.toLocaleDateString("en-US", { timeZone: "Asia/Kolkata" }), // Displayed as local date
    });
  } catch (e) {
    console.error("An error occurred:", e.message);
    return res.status(500).send("Something went wrong!");
  }
};





const applyCoupon = async (req, res) => {
  try {
      const { couponCode } = req.body;
      const cart = req.session.cart;

      if (!cart || !cart.items || cart.items.length === 0) {
          return res.json({ success: false, message: "Cart is empty" });
      }

      
      const productIds = cart.items.map(item => item.productId); 
      const products = await Product.find({ _id: { $in: productIds } }, 'productOffer');

      
      const productOfferMap = products.reduce((acc, product) => {
          acc[product._id.toString()] = product.productOffer || 0; 
          return acc;
      }, {});

      
      const totalProductOffer = cart.items.reduce((acc, item) => {
          const offerAmount = productOfferMap[item.productId.toString()] || 0;
          return acc + (offerAmount * item.quantity);
      }, 0);

     
      const subTotal = cart.items.reduce((acc, item) => acc + (item.price * item.quantity), 0); 
      const totalOfferPrice = subTotal - totalProductOffer; 
      req.session.cart.subTotal = subTotal;
      const coupon = await Coupon.findOne({ name: couponCode });

      if (!coupon) {
          return res.json({ success: false, message: "Invalid Coupon" });
      }

      const today = new Date();
      if (today < new Date(coupon.createdOn) || today > new Date(coupon.expireOn)) {
          return res.json({ success: false, message: "Coupon Expired or Not Yet Valid" });
      }

      if (totalOfferPrice < coupon.minimumPrice) {
          return res.json({ success: false, message: `Minimum purchase should be ₹${coupon.minimumPrice}` });
      }

      const couponDiscount = coupon.offerPrice;
      req.session.cart.appliedCoupon = {
          name: coupon.name,
          discount: couponDiscount,
      };

      const finalTotal = totalOfferPrice - couponDiscount; 

      return res.json({ 
          success: true, 
          message: "Coupon Applied Successfully!", 
          subTotal, 
          totalProductOffer, 
          totalOfferPrice, 
          finalTotal, 
          couponDiscount
      });
  } catch (error) {
      console.error("Error applying coupon:", error);
      return res.json({ success: false, message: "Something went wrong" });
  }
};




const removeCoupon = async (req, res) => {
  try {
      const cart = req.session.cart;
console.log(cart);
      if (!cart.appliedCoupon) {
          return res.json({ success: false, message: "No coupon applied" });
      }
      delete req.session.cart.appliedCoupon;
      const finalTotal = cart.subTotal; 

      return res.json({ success: true, message: "Coupon Removed", finalTotal });
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
  removeCoupon
};

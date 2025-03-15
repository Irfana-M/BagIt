const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const getUserWallet = async (req, res) => {
  try {
      const userId = req.session.user;

      userData = await User.findOne({ _id: userId });
      const wallet = await Wallet.findOne({ userId: userId });

      if (!wallet) {
        return res.render('wallet', {
            wallet: { balance: 0, transactions: [] },
            pagination: {  
                page: 1,
                limit: 5,
                totalTransactions: 0,
                totalPages: 1,
            },
            user: userData,
        });
    }
    
      const page = parseInt(req.query.page) || 1; 
      const limit = parseInt(req.query.limit) || 5; 
      const skip = (page - 1) * limit; 
     
      const transactions = wallet.transactions
          .sort((a, b) => b.date - a.date) 
          .slice(skip, skip + limit); 

      
      res.render('wallet', {
          wallet: {
              balance: wallet.balance,
              transactions: transactions,
          },
          pagination: {
            user:userData,
              page: page,
              limit: limit,
              totalTransactions: wallet.transactions.length,
              totalPages: Math.ceil(wallet.transactions.length / limit),
          },
          user:userData,
      });
  } catch (error) {
      console.error(error);
      res.status(500).send("Server Error");
  }
};

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


const createWalletOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const options = {
      amount: amount * 100, 
      currency: "INR",
      receipt: `wallet_${Date.now()}`,
      payment_capture: 1, 
    };

    const order = await razorpay.orders.create(options);

    res.json({ success: true, order });
  } catch (error) {
    console.error("Razorpay Order Error:", error);
    res.status(500).json({ success: false, message: "Error creating order" });
  }
};


const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const userId = req.session.user;

    
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] });
    }
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }
    wallet.balance += numericAmount;
    
    wallet.balance += amount;
    wallet.transactions.push({
      amount,
      type: "credit",
      description: "Money added via Razorpay",
    });

    await wallet.save();
    res.json({ success: true, message: "Wallet updated successfully", wallet });
  } catch (error) {
    console.error("Payment Verification Error:", error);
    res.status(500).json({ success: false, message: "Error verifying payment" });
  }
};

      const withdrawfromWallet = async (req, res) => {
        const { amount } = req.body;
    
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid amount' });
        }
    
        try {
            const userId = req.session.user
            let wallet = await Wallet.findOne({ userId: userId });
    console.log(wallet)
            if (!wallet) {
                return res.status(404).json({ success: false, message: 'Wallet not found' });
            }
    
            if (wallet.balance < amount) {
                return res.status(400).json({ success: false, message: 'Insufficient balance' });
            }
    
            wallet.balance -= amount;
            wallet.transactions.push({
                amount,
                type: 'debit',
                description: 'Money withdrawn from wallet'
            });
    
            await wallet.save();
            res.json({ success: true, wallet });
        } catch (error) {
            console.error('Withdraw Error:', error);
            res.status(500).json({ success: false, message: 'Server Error' });
        }
    };
    
module.exports = {getUserWallet,createWalletOrder,verifyPayment,withdrawfromWallet}
const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema")

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
                limit: 10,
                totalTransactions: 0,
                totalPages: 1,
            },
            user: userData,
        });
    }
    
      const page = parseInt(req.query.page) || 1; 
      const limit = parseInt(req.query.limit) || 10; 
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


  const addtoWallet = async (req,res)=>{
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
          return res.status(400).json({ success: false, message: 'Invalid amount' });
        }
      
        try {
            const userId = req.session.user
          let wallet = await Wallet.findOne({ userId: userId });
      
          if (!wallet) {
            wallet = new Wallet({ userId: userId, balance: amount, transactions: [] });
          } else {
            wallet.balance += amount;
          }
      
          wallet.transactions.push({
            amount,
            type: 'credit',
            description: 'Money added to wallet'
          });
      
          await wallet.save();
          res.json({ success: true, wallet });
        } catch (error) {
            console.error(error);
          res.status(500).json({ success: false, message: 'Server Error' });
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
    
module.exports = {getUserWallet,addtoWallet,withdrawfromWallet}
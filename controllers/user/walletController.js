const getUserWallet = async (req,res)=>{
    try {
        const wallet = await Wallet.findOne({ userId: req.user._id }).populate('transactions.orderId');
        res.render("wallet");
        if (!wallet) {
          return res.status(404).json({ success: false, message: 'Wallet not found' });
        }
        res.json({ success: true, wallet });
      } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
      }
    };


    const addMoneytoWallet = async (req,res)=>{
        try {
            const { amount } = req.body;
            const wallet = await Wallet.findOne({ userId: req.user._id });
            if (!wallet) {
              return res.status(404).json({ success: false, message: 'Wallet not found' });
            }
            wallet.transactions.push({
              type: 'credit',
              amount,
              description: 'Added Money to Wallet',
            });
            wallet.balance += amount;
            await wallet.save();
            res.json({ success: true, wallet });
          } catch (error) {
            res.status(500).json({ success: false, message: 'Server error' });
          }
        };

    const withdrawMoneyfromWallet = async (req,res)=>{
        try {
            const { amount } = req.body;
            const wallet = await Wallet.findOne({ userId: req.user._id });
            if (!wallet) {
              return res.status(404).json({ success: false, message: 'Wallet not found' });
            }
            if (wallet.balance < amount) {
              return res.status(400).json({ success: false, message: 'Insufficient balance' });
            }
            wallet.transactions.push({
              type: 'debit',
              amount,
              description: 'Withdrawal to Bank Account',
            });
            wallet.balance -= amount;
            await wallet.save();
            res.json({ success: true, wallet });
          } catch (error) {
            res.status(500).json({ success: false, message: 'Server error' });
          }
        };

module.exports = {getUserWallet,addMoneytoWallet,withdrawMoneyfromWallet}
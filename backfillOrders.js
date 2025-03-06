const mongoose = require('mongoose');
const Order = require('./models/orderSchema'); // Ensure the correct path to your Order model
const Product = require('./models/productSchema'); // Ensure the correct path to your Product model

// Replace 'your_mongodb_connection_string' with your actual MongoDB connection string
const mongoURI = 'mongodb://localhost:27017/nodewebapp'; // Example connection string

// Connect to your MongoDB database
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const backfillOrders = async () => {
    try {
        // Fetch all orders from the database
        const orders = await Order.find({});

        // Iterate through each order
        for (const order of orders) {
            // Iterate through each item in the order
            for (const item of order.orderItems) {
                // Check if productName or productImage is missing
                if (!item.productName || !item.productImage) {
                    // Fetch the corresponding product from the Product collection
                    const product = await Product.findById(item.product);
                    if (product) {
                        // Update the order item with productName and productImage
                        item.productName = product.productName || null;
                        item.productImage = product.productImage?.[0] || null; // Use the first image if available
                    }
                }
            }
            // Save the updated order
            await order.save();
        }

        console.log("Backfill completed successfully.");
    } catch (error) {
        console.error("Error during backfill:", error);
    } finally {
        // Close the database connection
        mongoose.connection.close();
    }
};

// Execute the backfill function
backfillOrders();
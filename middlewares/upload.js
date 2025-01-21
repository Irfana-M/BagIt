const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Define upload directory
const uploadDir = path.join(__dirname, '..', 'uploads', 'images');

// Check if the directory exists, if not, create it
if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('Uploads directory created!');
    } catch (err) {
        console.error('Error creating uploads directory:', err);
    }
}

// Set up multer storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir); // Save to the images folder inside uploads
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname)); // Preserve file extension
    }
});

// Initialize multer with storage options
const uploads = multer({ storage: storage });

module.exports = uploads;

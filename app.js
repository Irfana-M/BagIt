const express = require('express');
const app = express();
const path = require('path');
const env = require('dotenv').config();
const session = require('express-session');
const passport = require("./config/passport");  
const db = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const User = require('./models/userSchema');
const MongoStore = require("connect-mongo");


db()

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(session({
  secret:process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized:false,
  cookie:{
    secure: process.env.NODE_ENV === "production",
    httpOnly:true,
    maxAge:72*60*60*1000
  } 
}))
app.use(passport.initialize());
app.use(passport.session()); // Ensure this is only called once

app.get("/auth/google/callback", passport.authenticate("google", {
  successRedirect: "/",
  failureRedirect: "/login",
}), (req, res) => {
  console.log("User after Google login:", req.user); // Check if user is set
  res.redirect("/");
});


// app.use(
//   session({
//       secret: process.env.SESSION_SECRET,
//       resave: false,
//       saveUninitialized: false,
//       store: MongoStore.create({
//           mongoUrl: process.env.MONGO_URI,
//           collectionName: "sessions",
//       }),
//       cookie: {
//           secure: process.env.NODE_ENV === "production", // Set secure cookies in production
//           httpOnly: true,
//           maxAge: 1000 * 60 * 60 * 24, // 1 day
//       },
//   })
// );



app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(passport.initialize());
app.use(passport.session());
app.set('view engine','ejs');
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

app.use(express.static('public'));
app.use('/',userRouter);
app.use('/admin',adminRouter);

app.listen(process.env.PORT, ()=>{
    console.log('Server Running');
    })

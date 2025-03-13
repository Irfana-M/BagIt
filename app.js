const express = require('express');
const app = express();
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const passport = require("./config/passport");  
const db = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const User = require('./models/userSchema');
const MongoStore = require("connect-mongo");

dotenv.config();

db()

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(session({
  secret:process.env.SESSION_SECRET,
  resave:false,
  saveUninitialized:false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie:{
    secure: process.env.NODE_ENV === "production",
    httpOnly:true,
    sameSite: 'lax',
    maxAge:72*60*60*1000
  } 
}))

app.use(passport.initialize());
app.use(passport.session()); 

app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  next();
});

app.set('view engine','ejs');
app.set('views', [
  path.join(__dirname, 'views/user'),
  path.join(__dirname, 'views/admin'),
]);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

app.use(express.static('public', {
  setHeaders: (res, path) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));


app.use('/',userRouter);
app.use('/admin',adminRouter);

app.listen(process.env.PORT, ()=>{
    console.log('Server Running');
    })

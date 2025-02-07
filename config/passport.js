const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const  User = require('../models/userSchema');
const env = require('dotenv').config();

passport.use(new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:'/auth/google/callback',
    scope:['profile','email'],
    prompt:'select-account'
},
  async(accessToken,refreshToken,profile,done)=>{
    
    try {
        let user = await User.findOne({googleId:profile.id});
        if(user){

            console.log(user);
            // if(user.isBlocked){
            //     return done(null,false,{message:'your are blocked!'});
               
                
            // }

            return done(null,user); 
        }else{
            user = new User({
                name:profile.displayName,
                email:profile.emails[0].value,
                googleId:profile.id,

            });
            await user.save();
            return done(null,user);
        }
        
    } catch (error) {
        return done(error,null)
    }
  }
));

passport.serializeUser((user,done)=>{
done(null,user.id)
});

passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
       return done(null,user)
        
    })
    .catch(err =>{
      return  done(err,null)
        console.log('error');
    })
})
module.exports = passport
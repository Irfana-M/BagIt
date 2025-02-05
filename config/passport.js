const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require("../models/userSchema");
const env = require('dotenv').config();


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
            return done(null, user);
        } else {
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
            });

            await user.save();
            return done(null, user);
        }
    } catch (error) {
        console.error("Error in Google Strategy:", error); // Log errors
        return done(error, null);
    }
}));


// passport.use(new GoogleStrategy({
//     clientID: process.env.GOOGLE_CLIENT_ID,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: '/auth/google/callback'
// },
// async (accessToken, refreshToken, profile, done) => {
//     try {
//         let user = await User.findOne({ googleId: profile.id });

//         if (user) {
//             return done(null, user);
//         } else {
//             user = new User({
//                 name: profile.displayName,
//                 email: profile.emails[0].value,
//                 googleId: profile.id,
//             });

//             await user.save();
//             return done(null, user);
//         }
//     } catch (error) {
//         return done(error, null);
//     }
// }));

// ✅ Store googleId in the session
// passport.serializeUser((user, done) => {
//     done(null, { id: user.id, googleId: user.googleId });
// });
passport.serializeUser((user, done) => {
    done(null, user.id); // Only store the user ID
});

passport.deserializeUser(async (obj, done) => {
    try {
        console.log("Deserializing user at:", new Date().toISOString()); // Debug timestamp
        if (!obj?.id) return done(null, false);

        const user = await User.findById(obj.id).select("name email").lean();
        console.log("Deserialized user:", user); // Debug user

        if (user) {
            done(null, user);
        } else {
            done(null, false);
        }
    } catch (error) {
        
        done(error, null);
    }
});

module.exports = passport;

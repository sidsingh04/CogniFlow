const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const { agentCredentials, superCredentials } = require("../models/Credentials.js");
const dotenv = require("dotenv");

dotenv.config();

const opts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
};

module.exports = (passport) => {
    passport.use(
        new JwtStrategy(opts, async (jwt_payload, done) => {
            try {
                // Determine which collection to check based on the role in payload
                if (jwt_payload.role === 'supervisor') {
                    const user = await superCredentials.findOne({ superId: jwt_payload.id });
                    if (user) {
                        return done(null, { ...user.toObject(), role: 'supervisor' });
                    }
                } else if (jwt_payload.role === 'agent') {
                    const user = await agentCredentials.findOne({ agentId: jwt_payload.id });
                    if (user) {
                        return done(null, { ...user.toObject(), role: 'agent' });
                    }
                }
                return done(null, false);
            } catch (err) {
                console.error("Passport strategy error:", err);
                return done(err, false);
            }
        })
    );
};

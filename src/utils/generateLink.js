import crypto from "crypto";


export const generateLink = (username) => {
        return crypto.randomBytes(25).toString("hex") + username + crypto.randomBytes(155).toString("hex");
}
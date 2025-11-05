import bcrypt from "bcrypt"


export const hashThePassword = (password) => {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
}
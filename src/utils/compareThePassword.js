import { compareSync } from "bcrypt";
export const compareThePassword = (password, hashedPassword) => {
    return compareSync(password, hashedPassword);
}
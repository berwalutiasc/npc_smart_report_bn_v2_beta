export const generateUserId = (token) => {
    try{
        const userId = token.substring(50,56);
        return userId;
    }catch(error){
        console.log(error)
        return res.status(500).json({error: "Internal Server Error"})
    }
}
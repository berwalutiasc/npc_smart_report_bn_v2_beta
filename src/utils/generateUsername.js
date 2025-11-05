
export const generateUsername = (name) => {
    //check if the name is valid
    if(!name || typeof name !== "string")  return null;
    //now generating initals
    let nameInitials = name.trim().split(/\s+/).map(word => word[0].toUpperCase()).join("");
    //loop 
    while(nameInitials.length < 6){
        //add a random digits
        nameInitials += Math.floor(Math.random() * 10);
    }
    const username = nameInitials
    return username;
}
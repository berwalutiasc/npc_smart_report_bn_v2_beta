class SocketService  {
    constructor() {
        this.io = null
    }


    setIO(io){
        this.io = io
    }



    emitUserRegistered(user) {
        if(this.io) {
            this.io.emit("user_registered", {
                message: "New user registered",
                user: user
            });
        }
    }
}

export default new SocketService();
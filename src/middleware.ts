import {type Request, type Response, NextFunction } from "express"
import jwt, { JwtPayload } from "jsonwebtoken"
import { LinkModel, UserModel } from "./db"

export const userMiddleWareForAuthAndPublic = async (req:Request, res:Response, next:NextFunction) => {
    try{
        const sharedBrainLink = req.params.sharedBrainLink
        const authToken = req.headers.authorization || req.headers.Authorization

        // target user id is the user id of the person whose brain we are targeting to edit
        let targetUserId: string | undefined;
        let authenticatedUserId: string | undefined
        // so we check for the shared brain link and if it is not present then we check for the auth token if that to is not present then we send a 404 code
        if(sharedBrainLink){
            const doesLinkExists = await LinkModel.findOne({
                hash:sharedBrainLink
            }) 
            if(!doesLinkExists){
                res.status(400).send("Invalid Shared Link")
                return;
            }
            const isPublicEditAllowed = await UserModel.findOne({
                _id:doesLinkExists.userId,
                publicEditAllowed:true
            })
            if(!isPublicEditAllowed){
                res.status(400).send("This content can only be viewed")
                return;
            }
            targetUserId = doesLinkExists.userId.toString();
        }

        // this middlelware atleast want one of the two things
        /*
            either auth token in the headers
            or the shared link
        */

        if(authToken){
            const decodedUser = jwt.verify(authToken as string, process.env.JWT_USER_SECRET as string) as JwtPayload
            authenticatedUserId = decodedUser.id;
        }
        if(!targetUserId && !authenticatedUserId){
            res.status(400).send("Authorization is required")
            return;
        }

        // what the below does is this
        /*
            if some one is accessing the shared brain then the userId becomes the user id of the person who is sharing the brain

            and if someone  is using their own token then it becomes the their own id
        */
        req.userId =  targetUserId || authenticatedUserId;

        /*
            this stores the authenticated token id of the user who had their token and it remains undefined if no token was provided
        */
        req.authenticatedUserId = authenticatedUserId;

        /*
            this stores the target user id i.e. id of the user whose brain is shared and it remains undefined if the brain is not shared 
        */
        req.targetUserId = targetUserId;

        next();
        
    }
    catch(err){
        res.status(400).send(`Error occured while validating the user ${err}`)
    }
}
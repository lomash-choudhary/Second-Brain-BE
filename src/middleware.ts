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

        // First, resolve the logged-in account (if a valid token was supplied)
        if(authToken){
            try{
                const decodedUser = jwt.verify(authToken as string, process.env.JWT_USER_SECRET as string) as JwtPayload
                authenticatedUserId = decodedUser.id;
            } catch(e){
                res.status(401).send("Your session is invalid or has expired, please log in again")
                return;
            }
        }

        // When the request targets a shared brain we validate the link, the
        // owner's edit permission, and require the requester to be logged in.
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
                res.status(403).send("This content can only be viewed")
                return;
            }
            // Only registered/logged-in accounts are allowed to edit a shared brain
            if(!authenticatedUserId){
                res.status(401).send("You need to be logged in to edit this brain")
                return;
            }
            targetUserId = doesLinkExists.userId.toString();
        }

        // this middlelware atleast want one of the two things
        /*
            either auth token in the headers
            or the shared link
        */

        if(!targetUserId && !authenticatedUserId){
            res.status(401).send("Authorization is required")
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
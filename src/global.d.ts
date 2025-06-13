import express from "express"
declare global {
    namespace Express{
        interface Request{
            userId?: String,
            targetUserId?:String,
            authenticatedUserId?:String
        }
    }
}
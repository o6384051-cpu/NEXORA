import { timingSafeEqual } from "node:crypto";
const COOKIE="nexora_session";
function b64(input:string){return Buffer.from(input).toString("base64url");}
async function sign(value:string){const secret=process.env.NEXORA_SESSION_SECRET;if(!secret)throw new Error("NEXORA_SESSION_SECRET غير مضبوط.");const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));return Buffer.from(sig).toString("base64url");}
export async function createSession(){const payload=b64(JSON.stringify({exp:Date.now()+8*60*60*1000}));return payload+"."+await sign(payload);}
export async function isAuthorized(request:Request){try{const secret=process.env.NEXORA_SESSION_SECRET;if(!secret)return false;const cookie=request.headers.get("cookie")||"";const token=cookie.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);if(!token)return false;const [payload,signature]=token.split(".");if(!payload||!signature)return false;const expected=await sign(payload);const a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return false;const data=JSON.parse(Buffer.from(payload,"base64url").toString()) as {exp:number};return data.exp>Date.now();}catch{return false;}}
export function sessionCookie(token:string){return COOKIE+"="+token+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800";}
export function clearSessionCookie(){return COOKIE+"=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";}

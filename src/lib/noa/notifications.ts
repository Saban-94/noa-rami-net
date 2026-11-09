import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
export async function registerPush() {
  const appId=import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID'];
  const apiKey=import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY'];
  const projectId=import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID'];
  const vapidKey=import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY'];
  if (!appId || !apiKey || !projectId || !vapidKey) return { status: 'not-configured' as const };
  if (!('Notification' in window) || !(await isSupported())) return { status:'unsupported' as const };
  if (window.top!==window.self) return {status:'open-in-new-tab' as const};
  const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(permission!=='granted') return {status:'denied' as const};
  const config={appId,apiKey,projectId,messagingSenderId:appId.split(':')[1] || ''};
  const registration=await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${new URLSearchParams(config)}`);
  const app=getApps()[0] || initializeApp(config);
  const messaging=getMessaging(app);
  const token=await getToken(messaging,{vapidKey,serviceWorkerRegistration:registration});
  if(!token) return {status:'denied' as const};
  return {status:'registered' as const,token,listen:(fn:()=>void)=>onMessage(messaging,fn)};
}
export async function ring() {
  const ctx=new AudioContext(); await ctx.resume();
  const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.connect(gain);gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(660,ctx.currentTime);osc.frequency.setValueAtTime(880,ctx.currentTime+0.16);
  gain.gain.setValueAtTime(0.1,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.5);
  osc.start();osc.stop(ctx.currentTime+0.5);osc.onended=()=>void ctx.close();
}
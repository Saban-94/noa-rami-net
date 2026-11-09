import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { deliveryRow, deliverySheetId, deliverySheetTab, mayRequestTrip, mayShareLocation } from './mobile-rules';

export const mobileIdentity=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data,error}=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);
 if(error) throw new Error('לא ניתן לקרוא הרשאות');
 return {role:data?.[0]?.role || null};
});
export const mobileTrips=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data,error}=await context.supabase.from('noa_trips').select('*').order('created_at',{ascending:false}).limit(10);
 if(error) throw new Error('לא ניתן לקרוא נסיעות');return data;
});
export const requestTrip=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({destination:z.string().min(2).max(300)})).handler(async({context,data})=>{
 const {data:role}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'harel'});
 if(!mayRequestTrip(role?'harel':null)) throw new Error('רק הראל רשאי לבקש שיתוף');
 const {data:trip,error}=await context.supabase.from('noa_trips').insert({requested_by:context.userId,destination:data.destination}).select().single();
 if(error) throw new Error('הבקשה לא נשמרה');
 // The caller's Harel role was verified before privileged recipient lookup.
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:drivers}=await supabaseAdmin.from('user_roles').select('user_id').eq('role','rami');
 const ids=drivers?.map(d=>d.user_id) || [];
 const {data:devices}=ids.length?await supabaseAdmin.from('noa_devices').select('token').in('user_id',ids):{data:[]};
 let delivered=0;
 const key=process.env['FIREBASE_MESSAGING_API_KEY'];const gatewayKey=process.env['LOVABLE_API_KEY'];
 if(key && gatewayKey) for(const device of devices || []) {
  const response=await fetch('https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send',{method:'POST',headers:{Authorization:`Bearer ${gatewayKey}`,'X-Connection-Api-Key':key,'Content-Type':'application/json'},body:JSON.stringify({message:{token:device.token,notification:{title:'הראל מבקש שיתוף נסיעה',body:data.destination},webpush:{fcm_options:{link:new URL('/mobile',process.env['APP_ORIGIN'] || 'https://id-preview--9b0bfcac-3922-4446-8782-aa40815a87e3.lovable.app').href}},data:{path:'/mobile'}}})});
  if(response.ok) delivered++; else console.error('FCM send failed',response.status);
 }
 return {trip,delivered};
});
export const decideTrip=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),accept:z.boolean()})).handler(async({context,data})=>{
 const {data:role}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'rami'});if(!role) throw new Error('רק ראמי רשאי לאשר');
 const {data:trip,error}=await context.supabase.from('noa_trips').update({driver_id:context.userId,status:data.accept?'sharing':'declined',consented_at:data.accept?new Date().toISOString():null}).eq('id',data.id).eq('status','requested').select().single();
 if(error) throw new Error('הבקשה כבר השתנתה');return trip;
});
export const updateTrip=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().min(0),wazeUrl:z.string().max(2000).optional(),arrival:z.string().max(40).optional()})).handler(async({context,data})=>{
 const {data:role}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'rami'});
 const {data:trip}=await context.supabase.from('noa_trips').select('status,consented_at,driver_id').eq('id',data.id).single();
 if(!trip || trip.driver_id!==context.userId || !mayShareLocation(role?'rami':null,trip.status,Boolean(trip.consented_at))) throw new Error('נדרש אישור שיתוף');
 if(data.wazeUrl){const u=new URL(data.wazeUrl);if(u.protocol!=='https:' || !['waze.com','www.waze.com'].includes(u.hostname) || u.pathname!=='/ul') throw new Error('קישור Waze לא תקין');}
 const {error}=await context.supabase.from('noa_trips').update({latitude:data.latitude,longitude:data.longitude,accuracy:data.accuracy,location_updated_at:new Date().toISOString(),...(data.wazeUrl?{waze_url:data.wazeUrl}:{}),...(data.arrival?{arrival_time:data.arrival}:{})}).eq('id',data.id).eq('status','sharing');if(error)throw new Error('המיקום לא נשמר');return {ok:true};
});
export const stopTrip=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid()})).handler(async({context,data})=>{
 const {error}=await context.supabase.from('noa_trips').update({status:'stopped',stopped_at:new Date().toISOString()}).eq('id',data.id).eq('driver_id',context.userId).eq('status','sharing');if(error)throw new Error('השיתוף לא הופסק');return {ok:true};
});
export const registerDevice=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({token:z.string().min(20).max(4096)})).handler(async({context,data})=>{
 const {error}=await context.supabase.from('noa_devices').upsert({user_id:context.userId,token:data.token},{onConflict:'token'});if(error)throw new Error('המכשיר לא נרשם');return {ok:true};
});
export const saveDelivery=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),number:z.string().min(1).max(80),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),customer:z.string().min(1).max(200),address:z.string().max(300),items:z.string().min(1).max(4000),documentUrl:z.union([z.literal(''),z.string().url()])})).handler(async({context,data})=>{
 const {data:roles}=await context.supabase.from('user_roles').select('role').eq('user_id',context.userId);if(!roles?.length)throw new Error('אין הרשאה לכתיבה');
 const key=process.env['GOOGLE_SHEETS_API_KEY'];const gatewayKey=process.env['LOVABLE_API_KEY'];if(!key || !gatewayKey)throw new Error('הגיליון לא מחובר');
 const {data:existing}=await context.supabase.from('noa_delivery_writes').select('status,sheet_row').eq('id',data.id).maybeSingle();
 if(existing?.status==='saved')return {ok:true,row:existing.sheet_row};
 if(existing)throw new Error('הרישום כבר החל; יש לבדוק את הגיליון לפני ניסיון נוסף');
 const {error:insertError}=await context.supabase.from('noa_delivery_writes').insert({id:data.id,user_id:context.userId,note_number:data.number,payload:data});if(insertError)throw new Error('הרישום כבר קיים');
 const response=await fetch(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${deliverySheetId}/values/${deliverySheetTab}!A:S:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,{method:'POST',headers:{Authorization:`Bearer ${gatewayKey}`,'X-Connection-Api-Key':key,'Content-Type':'application/json'},body:JSON.stringify({values:[deliveryRow(data,new Date().toISOString())]})});
 if(!response.ok){console.error('Sheets write failed',response.status);await context.supabase.from('noa_delivery_writes').update({status:'failed'}).eq('id',data.id);throw new Error(`הכתיבה לגיליון נכשלה (${response.status})`);}
 const result=await response.json() as {updates?:{updatedRange?:string}};const row=result.updates?.updatedRange || '';
 await context.supabase.from('noa_delivery_writes').update({status:'saved',sheet_row:row}).eq('id',data.id);return {ok:true,row};
});

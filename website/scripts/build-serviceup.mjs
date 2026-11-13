/**
 * ServiceUp static build adapter. No browser requests or secrets.
 * Requires the tenant-scoped public API and an imported manifest.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const ROOT=process.cwd();
const API=(process.env.SERVICEUP_API_BASE||process.env.VITE_API_BASE||'').trim().replace(/\/+$/,'');
const TENANT=(process.env.SERVICEUP_TENANT||process.env.VITE_SERVICEUP_TENANT||'james-jared-taylor').trim();
if(!API||!(/^https:\/\//.test(API)||(process.env.SERVICEUP_TEST_LOCAL==='1'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(API))))throw Error('SERVICEUP_API_BASE or VITE_API_BASE must be an HTTPS ServiceUp API origin. Keeping previous Netlify deployment.');
if(TENANT!=='james-jared-taylor')throw Error('Refusing to build an incorrect tenant.');
const manifest=JSON.parse(fs.readFileSync('serviceup/james-jared-taylor-import.json','utf8'));
const baseline={site:JSON.parse(fs.readFileSync('content/site.json','utf8')),works:JSON.parse(fs.readFileSync('content/works.json','utf8')),posts:JSON.parse(fs.readFileSync('content/posts.json','utf8'))};
async function get(endpoint){
 const response=await fetch(`${API}${endpoint}`,{headers:{'x-serviceup-tenant':TENANT,'accept':'application/json'},signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error(`ServiceUp ${endpoint}: HTTP ${response.status}. Aborting deploy; old deployment retained.`);
 return response.json();
}
function records(rows,type){
 if(!Array.isArray(rows))throw Error(`Invalid ServiceUp response for ${type}`);
 return rows.filter(x=>x.status==='published').map(x=>({slug:x.slug,status:x.status,...x.data}));
}
const required=['artwork','journal-post','page','artist-settings','artist-link','education','collection'];
// Promise requests are read-only; the API enforces tenant scope using request header and RLS.
const payload=await Promise.all(required.map(t=>get('/api/content/'+encodeURIComponent(t))));
const [works,posts,pages,settings,links,education,collections]=payload.map((rows,i)=>records(rows,required[i]));
if(!works.length||!pages.length||!settings.length)throw Error('Required published ServiceUp records are missing. No deployment generated.');
if(!pages.some(p=>p.slug==='home')||!pages.some(p=>p.slug==='about'))throw Error('Homepage or About page missing from ServiceUp.');
const validPages=new Set(['home','about','current-work','archive','blog','links','current-work-paintings','current-work-sculptures','archive-paintings','archive-sculptures']);
for(const name of validPages)if(!pages.some(p=>p.slug===name))throw Error(`Missing required page ${name}`);
const pageType=manifest.content_types.find(x=>x.slug==='page');
const fixedTemplates=new Map(pageType?.fields?.find(x=>x.key==='panels')?.config?.templates?.filter(x=>x.fixed).map(x=>[x.key,x.slots])||[]);
for(const page of pages){
 const current=page.panels;
 if(!current||!Array.isArray(current.panels))throw Error(`Invalid panel structure in ${page.slug}`);
 const expected=fixedTemplates.get(current.template);
 if(!expected||JSON.stringify(expected)!==JSON.stringify(current.panels.map(x=>x.type)))throw Error(`Fixed panel template mismatch in ${page.slug}`);
 const ids=current.panels.map(x=>x.id);
 if(ids.length!==new Set(ids).size||ids.some(x=>!x))throw Error(`Duplicate or missing panel IDs in ${page.slug}`);
}
const site={...baseline.site,...settings.find(s=>s.slug==='artist-profile')};
if(!site.name||!site.domain)throw Error('Artist profile lacks required name/domain');
// Site Settings and page fixed panels are editable; renderers own structure and CSS.
site.page_seo=Object.fromEntries(pages.map(p=>[p.slug==='home'?'home':p.slug.replace(/^(current-work|archive)-(paintings|sculptures)$/,'$1/$2'),{seo_title:p.seo_title,meta_description:p.meta_description,og_image:(typeof p.og_image==='object'?(p.og_image?.url||p.og_image?.public_url||p.og_image?.src):p.og_image)}]));
site.page_panels=Object.fromEntries(pages.map(p=>[p.slug==='home'?'home':p.slug.replace(/^(current-work|archive)-(paintings|sculptures)$/,'$1/$2'),p.panels]));
const home=pages.find(p=>p.slug==='home');
const homeHero=home.panels?.panels?.find(p=>p.type==='jjt-home-hero');
if(Array.isArray(homeHero?.data?.home_links))site.home_links=homeHero.data.home_links;
if(homeHero){site.home_left_artwork_slug=homeHero.data?.left_artwork_slug||site.home_left_artwork_slug;site.home_right_artwork_slug=homeHero.data?.right_artwork_slug||site.home_right_artwork_slug;}
site.collection_covers=Object.fromEntries(collections.map(x=>[x.slug,x.cover_artwork_slug]).filter(([,v])=>v));
const featured=home.panels?.panels?.find(x=>x.type==='jjt-featured-artwork');
if(Array.isArray(featured?.data?.featured_artwork_slugs)&&featured.data.featured_artwork_slugs.length)site.featured_artwork_slugs=featured.data.featured_artwork_slugs;
site.links=links.map(x=>({label:x.label,description:x.description,url:x.url}));
site.education=education.map(x=>({degree:x.degree,school:x.school,year:x.year})).sort((a,b)=>Number(b.year)-Number(a.year));
// Public Menu route is a read-only extension in the supplied Core patch.
const menu=await get('/api/public/menu/main');
if(!Array.isArray(menu.items)||!menu.items.length)throw Error('Main Menu missing in ServiceUp. Aborting build.');
site.navigation=menu.items.map(({label,url})=>({label,url}));
const normalizeImg=(value)=>typeof value==='object'?(value?.publicUrl||value?.url||value?.public_url||value?.src||''):value;
for(const w of works)w.image=normalizeImg(w.image);
site.portrait_image=normalizeImg(site.portrait_image);
const requiredArtKeys=['slug','title','category','collection','image'];
for(const w of works)for(const k of requiredArtKeys)if(!w[k])throw Error(`Artwork ${w.slug||'(unknown)'} missing ${k}`);
if(!works.some(x=>x.slug===site.home_left_artwork_slug)||!works.some(x=>x.slug===site.home_right_artwork_slug))throw Error('Homepage selected paintings are not published artwork records.');
// Deterministic newest-first without relying on database's pagination/order.
function dateKey(x){return String(x.published_at||x.created_at||'0000-00-00');}
const sort=(a,b)=>dateKey(b).localeCompare(dateKey(a))||a.slug.localeCompare(b.slug);
works.sort(sort);posts.sort(sort);
for(const item of posts){if(!Array.isArray(item.body))throw Error(`Journal ${item.slug}: body must be an array of paragraphs`);}
const contentDir=path.join(ROOT,'.serviceup-runtime');
fs.mkdirSync(contentDir,{recursive:true});
for(const [name,value] of Object.entries({site,works,posts}))fs.writeFileSync(path.join(contentDir,name+'.json'),JSON.stringify(value));
const output='dist/serviceup';
const result=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:ROOT,stdio:'inherit',env:{...process.env,CONTENT_DIR:contentDir,OUTPUT_DIR:output,BASE_PATH:'serviceup',SITE_ENV:'staging'}});
if(result.status!==0)throw Error('ServiceUp static build failed. No new deployment.');
// Do not overwrite the original root site; build root separately and retain subfolder.
const target=path.join(ROOT,output);
if(!fs.existsSync(path.join(target,'index.html')))throw Error('Missing generated ServiceUp homepage');
const check=spawnSync(process.execPath,['scripts/check.mjs'],{cwd:ROOT,stdio:'inherit',env:{...process.env,CHECK_DIR:output}});
if(check.status!==0)throw Error('ServiceUp static validation failed.');
console.log(`ServiceUp tenant ${TENANT}: ${works.length} artworks, ${posts.length} posts, ${pages.length} pages; published into /serviceup/`);
